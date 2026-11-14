// =============================================================================
// armazenamento.js: guarda a auditoria e as solicitações de acesso.
// Com DATABASE_URL usa o PostgreSQL (tabelas em db/init.sql).
// Sem DATABASE_URL usa listas em memória (para testes rápidos).
// Todas as funções são "async" para o resto do código não precisar saber qual.
// =============================================================================
import pg from 'pg'
import { config } from './config.js'

const usaBanco = Boolean(config.databaseUrl)
const pool = usaBanco ? new pg.Pool({ connectionString: config.databaseUrl }) : null

const memDecisoes = []
const memSolicitacoes = []

// O código mostrado ao usuário na Tela 4: id 38 vira "D-0038".
export const codigoDaDecisao = (id) => `D-${String(id).padStart(4, '0')}`

// Formato entregue ao front (painel de auditoria, Tela 5).
const decisaoParaApi = (l) => ({
  codigoDecisao: codigoDaDecisao(l.id),
  momento: l.momento,
  usuarioId: l.usuario_id,
  usuario: l.usuario_nome,
  sistema: l.sistema,
  decisao: l.permitido ? 'Permitido' : 'Negado',
  motivos: l.motivos,
})

// Formato interno de uma decisão (usado para validar pedidos de acesso).
const decisaoInterna = (l) => ({
  usuarioId: l.usuario_id, sistema: l.sistema, permitido: l.permitido, motivos: l.motivos,
})

// Busca uma decisão pelo código mostrado na Tela 4 (ex.: "D-0038"). Null se não existir.
export async function buscarDecisao(codigo) {
  const id = Number(/^D-(\d+)$/.exec(codigo ?? '')?.[1])
  if (!Number.isInteger(id) || id < 1) return null
  if (usaBanco) {
    const { rows } = await pool.query('SELECT * FROM decisoes WHERE id = $1', [id])
    return rows[0] ? decisaoInterna(rows[0]) : null
  }
  const linha = memDecisoes.find((l) => l.id === id)
  return linha ? decisaoInterna(linha) : null
}

// ---------------------------- AUDITORIA --------------------------------------
// Grava UMA decisão (permitida ou negada) e devolve o código dela.
export async function registrarDecisao(d) {
  if (usaBanco) {
    const { rows } = await pool.query(
      `INSERT INTO decisoes (usuario_id, usuario_nome, sistema, permitido, motivos, dispositivo, caminho)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [d.usuarioId, d.usuarioNome, d.sistema, d.permitido, d.motivos, d.dispositivo, d.caminho],
    )
    return codigoDaDecisao(rows[0].id)
  }
  const id = memDecisoes.length + 1
  memDecisoes.unshift({
    id, momento: new Date().toISOString(), usuario_id: d.usuarioId, usuario_nome: d.usuarioNome,
    sistema: d.sistema, permitido: d.permitido, motivos: d.motivos,
  })
  return codigoDaDecisao(id)
}

// Lista decisões, da mais recente para a mais antiga, com filtros opcionais.
export async function listarDecisoes({ usuario, sistema, decisao } = {}) {
  if (usaBanco) {
    const condicoes = []
    const valores = []
    // Cada filtro vira um parâmetro ($1, $2...), nunca texto colado no SQL (evita SQL injection).
    if (usuario) { valores.push(`%${usuario}%`); condicoes.push(`usuario_nome ILIKE $${valores.length}`) }
    if (sistema) { valores.push(sistema); condicoes.push(`sistema = $${valores.length}`) }
    if (decisao === 'Permitido') condicoes.push('permitido = true')
    if (decisao === 'Negado') condicoes.push('permitido = false')
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
    const { rows } = await pool.query(`SELECT * FROM decisoes ${where} ORDER BY id DESC LIMIT 200`, valores)
    return rows.map(decisaoParaApi)
  }
  return memDecisoes
    .filter((l) => !usuario || l.usuario_nome?.toLowerCase().includes(usuario.toLowerCase()))
    .filter((l) => !sistema || l.sistema === sistema)
    .filter((l) => !decisao || (decisao === 'Permitido') === l.permitido)
    .slice(0, 200)
    .map(decisaoParaApi)
}

// -------------------------- SOLICITAÇÕES (opcional) --------------------------
const solicitacaoParaApi = (l) => ({
  id: l.id,
  criadoEm: l.criado_em,
  usuarioId: l.usuario_id,
  usuario: l.usuario_nome,
  sistema: l.sistema,
  codigoDecisao: l.codigo_decisao,
  motivos: l.motivos, // códigos do motivo do bloqueio (ex.: fora_do_horario)
  justificativa: l.justificativa,
  periodoHoras: l.periodo_horas,
  status: l.status,
  aprovador: l.aprovador_nome,
})

export async function criarSolicitacao(s) {
  if (usaBanco) {
    const { rows } = await pool.query(
      `INSERT INTO solicitacoes (usuario_id, usuario_nome, sistema, codigo_decisao, motivos, justificativa, periodo_horas)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [s.usuarioId, s.usuarioNome, s.sistema, s.codigoDecisao, s.motivos, s.justificativa, s.periodoHoras],
    )
    return solicitacaoParaApi(rows[0])
  }
  const linha = {
    id: memSolicitacoes.length + 1, criado_em: new Date().toISOString(), usuario_id: s.usuarioId,
    usuario_nome: s.usuarioNome, sistema: s.sistema, codigo_decisao: s.codigoDecisao, motivos: s.motivos,
    justificativa: s.justificativa, periodo_horas: s.periodoHoras, status: 'pendente', aprovador_nome: null,
  }
  memSolicitacoes.push(linha)
  return solicitacaoParaApi(linha)
}

export async function buscarSolicitacao(id) {
  if (usaBanco) {
    const { rows } = await pool.query('SELECT * FROM solicitacoes WHERE id = $1', [id])
    return rows[0] ? solicitacaoParaApi(rows[0]) : null
  }
  const linha = memSolicitacoes.find((l) => l.id === id)
  return linha ? solicitacaoParaApi(linha) : null
}

export async function listarSolicitacoes(status) {
  if (usaBanco) {
    const { rows } = status
      ? await pool.query('SELECT * FROM solicitacoes WHERE status = $1 ORDER BY id DESC', [status])
      : await pool.query('SELECT * FROM solicitacoes ORDER BY id DESC')
    return rows.map(solicitacaoParaApi)
  }
  return memSolicitacoes.filter((l) => !status || l.status === status).reverse().map(solicitacaoParaApi)
}

// Só decide pedidos que ainda estão pendentes. Devolve null se não achar/já decidido.
export async function decidirSolicitacao(id, status, aprovadorNome) {
  if (usaBanco) {
    const { rows } = await pool.query(
      `UPDATE solicitacoes SET status = $2, aprovador_nome = $3, decidido_em = now()
       WHERE id = $1 AND status = 'pendente' RETURNING *`,
      [id, status, aprovadorNome],
    )
    return rows[0] ? solicitacaoParaApi(rows[0]) : null
  }
  const linha = memSolicitacoes.find((l) => l.id === id && l.status === 'pendente')
  if (!linha) return null
  Object.assign(linha, { status, aprovador_nome: aprovadorNome })
  return solicitacaoParaApi(linha)
}
