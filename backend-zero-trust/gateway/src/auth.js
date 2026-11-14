// =============================================================================
// auth.js: AUTENTICAÇÃO. Responde "quem é você e este token ainda vale?".
// Duas verificações, como no Diagrama 4 (passo "valida o token"):
//   1) Assinatura e validade do JWT, conferidas LOCALMENTE com as chaves públicas
//      do Keycloak (rápido, sem chamada de rede a cada requisição).
//   2) Introspecção: pergunta ao Keycloak se o token continua ATIVO. É isso que
//      faz uma revogação de sessão valer na hora, mesmo antes de o token expirar.
// =============================================================================
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { config } from './config.js'

const { urlInterna, realm, emissor, adminClientId, adminClientSecret } = config.keycloak

// Chaves públicas do Keycloak (JWKS). A biblioteca baixa e guarda em cache sozinha.
const chavesPublicas = createRemoteJWKSet(
  new URL(`${urlInterna}/realms/${realm}/protocol/openid-connect/certs`),
)

// Confere assinatura, emissor e validade. Lança erro se algo estiver errado.
// Devolve os dados do usuário que o resto do gateway usa.
export async function verificarToken(token) {
  // Não checamos "audience" aqui porque o Keycloak coloca "account" por padrão.
  // Em produção, configure um audience próprio para o gateway e valide-o.
  const { payload } = await jwtVerify(token, chavesPublicas, { issuer: emissor })
  return {
    id: payload.sub,
    login: payload.preferred_username,
    nome: payload.name ?? payload.preferred_username,
    perfis: payload.realm_access?.roles ?? [], // perfis vindos do Keycloak
    expiraEm: payload.exp,                     // quando o token expira (segundos desde 1970)
  }
}

// Pergunta ao Keycloak se o token ainda está ativo (não revogado, sessão viva).
export async function tokenAtivo(token) {
  const resposta = await fetch(
    `${urlInterna}/realms/${realm}/protocol/openid-connect/token/introspect`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        client_id: adminClientId,
        client_secret: adminClientSecret,
      }),
      signal: AbortSignal.timeout(3000),
    },
  )
  if (!resposta.ok) return false // na dúvida, trata como inativo (falha fechada)
  const dados = await resposta.json()
  return dados.active === true
}
