// =============================================================================
// pdp.js: conversa com o OPA (o PDP). O gateway NÃO decide nada sozinho: ele
// monta os fatos da requisição, pergunta ao OPA e obedece à resposta.
// =============================================================================
import { config } from './config.js'

// Pergunta à política (opa/policies/acesso.rego) se o acesso é permitido.
// Devolve { permitido: boolean, motivos: string[] }.
export async function consultarPolitica(entrada) {
  try {
    const r = await fetch(`${config.opaUrl}/v1/data/zerotrust/acesso/decisao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: entrada }),
      signal: AbortSignal.timeout(2000),
    })
    if (!r.ok) throw new Error(`OPA respondeu ${r.status}`)
    const { result } = await r.json()
    if (!result) throw new Error('OPA não devolveu decisão')
    return result
  } catch (erro) {
    // FALHA FECHADA: se o PDP estiver fora do ar, NEGA. Nunca libera "por garantia".
    console.error('[pdp] indisponível:', erro.message)
    return { permitido: false, motivos: ['pdp_indisponivel'] }
  }
}

// Registra no OPA uma exceção temporária (usada quando um gestor aprova um pedido).
// A política enxerga isso como data.excecoes.<usuario>.<sistema> = instante de expiração.
// Obs.: o OPA guarda isso em memória; ao reiniciar o container, as exceções somem.
export async function criarExcecao(usuarioId, sistema, expiraEpoch) {
  const r = await fetch(
    `${config.opaUrl}/v1/data/excecoes/${encodeURIComponent(usuarioId)}/${encodeURIComponent(sistema)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expiraEpoch),
      signal: AbortSignal.timeout(2000),
    },
  )
  if (!r.ok) throw new Error(`Falha ao criar exceção no OPA (${r.status})`)
}
