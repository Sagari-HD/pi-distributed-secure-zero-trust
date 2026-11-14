// =============================================================================
// index.js: o GATEWAY, que faz o papel de PEP (Policy Enforcement Point).
//
// Ele é a ÚNICA porta de entrada para os sistemas protegidos. A cada requisição:
//
//   1. AUTENTICA   -> confere o token JWT e se ele não foi revogado   (auth.js)
//   2. PERGUNTA    -> monta os fatos e consulta o OPA (o PDP)          (pdp.js)
//   3. REGISTRA    -> grava a decisão, permitida ou negada, na auditoria (armazenamento.js)
//   4. APLICA      -> se negado devolve 403; se permitido repassa ao sistema
//
// Isso é exatamente o Diagrama 4 (sequência da decisão Zero Trust).
// =============================================================================
import express from 'express'
import cors from 'cors'
import { createProxyMiddleware } from 'http-proxy-middleware'

import { config } from './config.js'
import { verificarToken, tokenAtivo } from './auth.js'
import { consultarPolitica, criarExcecao } from './pdp.js'
import { revogarSessoes, criarUsuario } from './admin.js'
import {
  registrarDecisao, listarDecisoes, buscarDecisao,
  criarSolicitacao, listarSolicitacoes, buscarSolicitacao, decidirSolicitacao,
} from './armazenamento.js'

// Textos amigáveis para a tela de "Acesso negado" (Tela 4).
const TEXTO_DO_MOTIVO = {
  perfil_sem_permissao: 'Perfil sem permissão',
  fora_do_horario: 'Fora do horário permitido',
  dispositivo_nao_confiavel: 'Dispositivo não reconhecido como confiável',
  pdp_indisponivel: 'Serviço de políticas indisponível',
  token_invalido_ou_revogado: 'Sessão inválida ou revogada',
}
// Nome da regra que gerou cada motivo (a Tela 4 mostra "Regra aplicada").
const REGRA_DO_MOTIVO = {
  perfil_sem_permissao: 'Perfil de acesso',
  fora_do_horario: 'Horário de acesso',
  dispositivo_nao_confiavel: 'Postura do dispositivo',
  pdp_indisponivel: 'Serviço de políticas',
  token_invalido_ou_revogado: 'Autenticação',
}
// Só estes motivos admitem pedir exceção ao gestor. Dispositivo não confiável, não.
const MOTIVOS_COM_EXCECAO = new Set(['perfil_sem_permissao', 'fora_do_horario'])

const permiteExcecao = (motivos) => motivos.length > 0 && motivos.every((m) => MOTIVOS_COM_EXCECAO.has(m))
// Acrescenta o texto do motivo ao pedido de acesso (a Tela 9 mostra o motivo do bloqueio).
const comTextos = (pedido) => ({ ...pedido, motivosTexto: pedido.motivos.map((m) => TEXTO_DO_MOTIVO[m] ?? m) })

const PERIODOS_PERMITIDOS = [1, 4, 24, 72] // horas de acesso temporário (1h, 4h, 1 dia, 3 dias)
// Perfis que o analista de RH pode conceder no cadastro. Perfis sensíveis (gestor_ti, que
// vê a auditoria e revoga sessões, e analista_rh, que cadastra pessoas) ficam de FORA:
// senão um analista de RH criaria uma conta de gestor de TI para si ou para outra pessoa.
const PERFIS_CADASTRAVEIS = ['acesso_financeiro', 'acesso_rh', 'gestor_area']

const app = express()

// CORS: deixa o front React (outra porta) chamar o gateway pelo navegador.
app.use(cors({
  origin: config.origemPermitida,
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Device-Posture', 'X-Simular-Hora'],
}))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// --- Utilitários -------------------------------------------------------------

// O Express 4 não captura erros de funções async sozinho; este envoltório faz isso.
const assincrono = (fn) => (req, res, next) => fn(req, res, next).catch(next)

// Hora cheia (0 a 23) no fuso da empresa, tirada do relógio do servidor.
function horaAtual() {
  const texto = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', hourCycle: 'h23', timeZone: config.fusoHorario,
  }).format(new Date())
  return Number.parseInt(texto, 10)
}

// --- Passo 1: AUTENTICAR -----------------------------------------------------
// Lê "Authorization: Bearer <token>", valida e coloca o usuário em req.usuario.
// "sistema" é opcional: se informado, a recusa de um token que foi REVOGADO entra na
// auditoria. Token ausente ou falso NÃO é gravado: qualquer pessoa na internet
// consegue mandar isso aos milhares e encheria a tabela (só vai para o log do servidor).
const autenticar = (sistema) => assincrono(async (req, res, next) => {
  const m = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')
  let usuario = null // só preenchido quando a assinatura do token confere
  try {
    if (!m) throw new Error('token ausente')
    usuario = await verificarToken(m[1])              // assinatura, emissor e validade
    if (!(await tokenAtivo(m[1]))) throw new Error('token revogado') // revogação
    req.usuario = usuario
    return next()
  } catch (erro) {
    if (sistema && usuario) {
      // Sabemos quem é (token autêntico, mas sessão derrubada): vale registrar.
      await registrarDecisao({
        usuarioId: usuario.id, usuarioNome: usuario.nome, sistema, permitido: false,
        motivos: ['token_invalido_ou_revogado'], dispositivo: null, caminho: req.url,
      })
    } else {
      console.warn(`[auth] requisição recusada (${erro.message}) em ${req.method} ${req.originalUrl}`)
    }
    return res.status(401).json({ erro: 'nao_autenticado', detalhe: erro.message })
  }
})

// --- Passos 2 e 3: PERGUNTAR ao PDP e REGISTRAR ------------------------------
const autorizar = (sistema) => assincrono(async (req, res, next) => {
  // Postura do dispositivo. No protótipo é SIMULADA por um cabeçalho; em produção
  // viria de um agente/MDM confiável, nunca de algo que o próprio usuário digita.
  // Se não vier nada, assume "nao_confiavel" (negar por padrão).
  const dispositivo = req.header('x-device-posture') ?? 'nao_confiavel'

  // Em demonstrações dá para simular outro horário (ex.: X-Simular-Hora: 22).
  const horaSimulada = Number(req.header('x-simular-hora'))
  const hora = config.permitirSimulacao && Number.isInteger(horaSimulada) && horaSimulada >= 0 && horaSimulada <= 23
    ? horaSimulada
    : horaAtual()

  // Os "fatos" que o OPA usa para decidir (ver comentário no topo de acesso.rego).
  const decisao = await consultarPolitica({
    usuario: { id: req.usuario.id, perfis: req.usuario.perfis },
    sistema,
    hora,
    dispositivo,
    agora_epoch: Math.floor(Date.now() / 1000),
  })

  // Toda decisão é registrada, permitida ou negada. O código volta para o usuário.
  const codigoDecisao = await registrarDecisao({
    usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, sistema,
    permitido: decisao.permitido, motivos: decisao.motivos, dispositivo, caminho: req.url,
  })

  // --- Passo 4: APLICAR a decisão ---
  if (!decisao.permitido) {
    return res.status(403).json({
      erro: 'acesso_negado',
      codigoDecisao,
      sistema,
      momento: new Date().toISOString(),
      motivos: decisao.motivos.map((m) => TEXTO_DO_MOTIVO[m] ?? m),
      motivosCodigo: decisao.motivos,
      regras: decisao.motivos.map((m) => REGRA_DO_MOTIVO[m] ?? m),
      // O front usa isto para mostrar (ou não) o botão "Solicitar acesso ao gestor".
      permiteExcecao: permiteExcecao(decisao.motivos),
    })
  }
  req.codigoDecisao = codigoDecisao
  return next()
})

// Repassa a requisição para o sistema protegido, já depois de liberada.
const repassarPara = (destino) => createProxyMiddleware({
  target: destino,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req) => {
      // O sistema de destino NÃO recebe o token: só os dados do usuário que o
      // gateway já verificou. (O nome vai codificado para aceitar acentos.)
      proxyReq.removeHeader('authorization')
      proxyReq.setHeader('x-usuario-id', req.usuario.id)
      proxyReq.setHeader('x-usuario-nome', encodeURIComponent(req.usuario.nome))
      proxyReq.setHeader('x-codigo-decisao', req.codigoDecisao)
    },
  },
})

// --- Rotas dos sistemas protegidos (devem vir ANTES do express.json) ---------
// O express.json lê o corpo da requisição; se rodasse antes, o corpo não chegaria
// ao proxy. Por isso só é ligado depois destas rotas.
app.use('/api/financeiro', autenticar('financeiro'), autorizar('financeiro'), repassarPara(config.sistemas.financeiro))
app.use('/api/rh', autenticar('rh'), autorizar('rh'), repassarPara(config.sistemas.rh))

app.use(express.json())

// Exige que o usuário tenha pelo menos um dos perfis informados.
const exigirPerfil = (...perfis) => (req, res, next) =>
  req.usuario.perfis.some((p) => perfis.includes(p))
    ? next()
    : res.status(403).json({ erro: 'perfil_insuficiente', exigidos: perfis })

// --- Quem sou eu (Tela 2: nome, perfis e quando a sessão expira) -------------
app.get('/me', autenticar(), (req, res) => {
  const { id, nome, login, perfis, expiraEm } = req.usuario
  res.json({ id, nome, login, perfis, expiraEm: new Date(expiraEm * 1000).toISOString() })
})

// --- Auditoria e revogação (Tela 5, gestor de TI) ----------------------------
app.get('/admin/auditoria', autenticar(), exigirPerfil('gestor_ti'),
  assincrono(async (req, res) => {
    const { usuario, sistema, decisao } = req.query
    const linhas = await listarDecisoes({ usuario, sistema, decisao })
    // Além dos códigos, devolve os textos que a Tela 5 mostra ("Regra aplicada").
    res.json(linhas.map((l) => ({
      ...l,
      motivosTexto: l.motivos.map((m) => TEXTO_DO_MOTIVO[m] ?? m),
      regras: l.motivos.map((m) => REGRA_DO_MOTIVO[m] ?? m),
    })))
  }))

// Derruba as sessões de um usuário. Na próxima requisição dele, a introspecção
// responde "inativo" e o gateway devolve 401.
app.post('/admin/sessoes/:usuarioId/revogar', autenticar(), exigirPerfil('gestor_ti'),
  assincrono(async (req, res) => {
    await revogarSessoes(req.params.usuarioId)
    res.status(204).end()
  }))

// --- Cadastro de pessoas (Tela 7, analista de RH) ----------------------------
app.post('/admin/pessoas', autenticar(), exigirPerfil('analista_rh'),
  assincrono(async (req, res) => {
    const { nome, sobrenome, email, perfis } = req.body ?? {}
    const emailValido = typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const perfisValidos = Array.isArray(perfis) && perfis.length > 0 && perfis.every((p) => PERFIS_CADASTRAVEIS.includes(p))
    if (!nome || !sobrenome || !emailValido || !perfisValidos) {
      return res.status(400).json({ erro: 'dados_invalidos', perfisPermitidos: PERFIS_CADASTRAVEIS })
    }
    try {
      const criado = await criarUsuario({ nome, sobrenome, email, perfis })
      return res.status(201).json(criado)
    } catch (erro) {
      if (erro.status === 409) return res.status(409).json({ erro: 'usuario_ja_existe' })
      throw erro
    }
  }))

// --- Solicitação de acesso (Telas 8 e 9) - módulo opcional -------------------
// 1) O colaborador pede (Tela 8). O pedido nasce de uma decisão de NEGAÇÃO dele (o
//    código D-xxxx da Tela 4). O gateway confere essa decisão em vez de confiar no
//    que o front enviou: o sistema e o motivo vêm do registro de auditoria.
app.post('/solicitacoes', autenticar(),
  assincrono(async (req, res) => {
    const { codigoDecisao, justificativa, periodoHoras } = req.body ?? {}
    const dadosValidos = typeof justificativa === 'string' && justificativa.trim().length >= 5
      && justificativa.length <= 500 && PERIODOS_PERMITIDOS.includes(periodoHoras)
    if (!dadosValidos) return res.status(400).json({ erro: 'dados_invalidos', periodosPermitidos: PERIODOS_PERMITIDOS })

    const decisao = await buscarDecisao(codigoDecisao)
    // A decisão precisa existir, ser DESTA pessoa e ter sido uma negação.
    if (!decisao || decisao.usuarioId !== req.usuario.id || decisao.permitido) {
      return res.status(400).json({ erro: 'decisao_invalida' })
    }
    // Dispositivo não confiável não admite exceção (ver acesso.rego).
    if (!permiteExcecao(decisao.motivos)) {
      return res.status(422).json({ erro: 'motivo_nao_permite_excecao', motivos: decisao.motivos })
    }
    // Um pedido pendente por pessoa e sistema.
    const pendentes = await listarSolicitacoes('pendente')
    if (pendentes.some((p) => p.usuarioId === req.usuario.id && p.sistema === decisao.sistema)) {
      return res.status(409).json({ erro: 'ja_existe_pedido_pendente' })
    }
    const criada = await criarSolicitacao({
      usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, sistema: decisao.sistema,
      codigoDecisao, motivos: decisao.motivos, justificativa: justificativa.trim(), periodoHoras,
    })
    res.status(201).json(comTextos(criada))
  }))

// 2) O gestor vê os pedidos pendentes (Tela 9).
app.get('/solicitacoes', autenticar(), exigirPerfil('gestor_area', 'gestor_ti'),
  assincrono(async (req, res) => {
    const lista = await listarSolicitacoes(req.query.status ?? 'pendente')
    res.json(lista.map(comTextos))
  }))

// 3) O gestor aprova ou nega. Aprovar cria uma EXCEÇÃO TEMPORÁRIA no OPA: ela
//    contorna perfil e horário até expirar, mas nunca o dispositivo (ver acesso.rego).
app.patch('/solicitacoes/:id', autenticar(), exigirPerfil('gestor_area'),
  assincrono(async (req, res) => {
    const id = Number(req.params.id)
    const { decisao } = req.body ?? {}
    if (!Number.isInteger(id) || !['aprovada', 'negada'].includes(decisao)) {
      return res.status(400).json({ erro: 'dados_invalidos' })
    }
    const existente = await buscarSolicitacao(id)
    if (!existente || existente.status !== 'pendente') {
      return res.status(404).json({ erro: 'pedido_nao_encontrado_ou_ja_decidido' })
    }
    // Separação de funções: ninguém aprova ou nega o PRÓPRIO pedido.
    if (existente.usuarioId === req.usuario.id) {
      return res.status(403).json({ erro: 'nao_pode_decidir_o_proprio_pedido' })
    }
    const pedido = await decidirSolicitacao(id, decisao, req.usuario.nome)
    if (!pedido) return res.status(404).json({ erro: 'pedido_nao_encontrado_ou_ja_decidido' })

    if (decisao === 'aprovada') {
      const expira = Math.floor(Date.now() / 1000) + pedido.periodoHoras * 3600
      try {
        await criarExcecao(pedido.usuarioId, pedido.sistema, expira)
      } catch (erro) {
        // Protótipo: a decisão já foi gravada. Em produção, faça as duas coisas numa transação.
        console.error('[solicitacoes] pedido aprovado, mas a exceção falhou:', erro.message)
        return res.status(502).json({ erro: 'excecao_nao_criada', pedido: comTextos(pedido) })
      }
    }
    return res.json(comTextos(pedido))
  }))

// Qualquer erro inesperado vira 500 sem vazar detalhes internos para quem chamou.
app.use((erro, _req, res, _next) => {
  console.error('[erro]', erro)
  res.status(500).json({ erro: 'erro_interno' })
})

app.listen(config.porta, () => {
  console.log(`Gateway (PEP) ouvindo na porta ${config.porta}`)
})
