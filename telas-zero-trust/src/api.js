// =============================================================================
// api.js: cliente do gateway. TODA chamada ao backend passa por aqui.
//
// O que ele faz em cada chamada:
//  - envia "Authorization: Bearer <token>" (o token vem do login no Keycloak);
//  - envia a postura do dispositivo (X-Device-Posture) e, se escolhida, a hora
//    simulada (X-Simular-Hora). Os dois são controles de DEMONSTRAÇÃO;
//  - devolve sempre { ok, status, dados }, sem lançar erro para status HTTP;
//  - se vier 401 (token vencido ou sessão revogada), avisa a aplicação.
// =============================================================================
import { config } from './config.js'

export function criarApi({
  baseUrl = config.gatewayUrl,
  obterToken,
  obterSimulacao = () => ({}),
  aoNaoAutenticado = () => {},
}) {
  async function chamar(metodo, caminho, corpo) {
    let token
    try {
      token = await obterToken()
    } catch {
      aoNaoAutenticado()
      return { ok: false, status: 401, dados: { erro: 'sem_sessao' } }
    }

    const simulacao = obterSimulacao()
    const cabecalhos = { Authorization: `Bearer ${token}` }
    if (simulacao.dispositivo) cabecalhos['X-Device-Posture'] = simulacao.dispositivo
    if (simulacao.hora !== '' && simulacao.hora != null) cabecalhos['X-Simular-Hora'] = String(simulacao.hora)
    if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json'

    let resposta
    try {
      resposta = await fetch(baseUrl + caminho, {
        method: metodo,
        headers: cabecalhos,
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      })
    } catch {
      return { ok: false, status: 0, dados: { erro: 'gateway_indisponivel' } }
    }

    const dados = resposta.status === 204 ? null : await resposta.json().catch(() => null)
    if (resposta.status === 401) aoNaoAutenticado()
    return { ok: resposta.ok, status: resposta.status, dados }
  }

  const consulta = (filtros) => {
    const p = new URLSearchParams()
    Object.entries(filtros).forEach(([k, v]) => v && p.set(k, v)) // só filtros preenchidos
    const texto = p.toString()
    return texto ? `?${texto}` : ''
  }

  return {
    eu: () => chamar('GET', '/me'),
    // Sistemas protegidos (passam por autenticação + política no gateway):
    lancamentos: () => chamar('GET', '/api/financeiro/lancamentos'),
    pessoas: () => chamar('GET', '/api/rh/pessoas'),
    // Auditoria e revogação (gestor de TI):
    auditoria: (filtros = {}) => chamar('GET', `/admin/auditoria${consulta(filtros)}`),
    revogarSessao: (usuarioId) => chamar('POST', `/admin/sessoes/${encodeURIComponent(usuarioId)}/revogar`),
    // Cadastro de pessoas (analista de RH):
    cadastrarPessoa: (dados) => chamar('POST', '/admin/pessoas', dados),
    // Solicitação de acesso temporário:
    criarSolicitacao: (dados) => chamar('POST', '/solicitacoes', dados),
    pendentes: () => chamar('GET', '/solicitacoes?status=pendente'),
    decidirSolicitacao: (id, decisao) => chamar('PATCH', `/solicitacoes/${id}`, { decisao }),
  }
}
