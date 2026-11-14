// =============================================================================
// admin.js: ações administrativas no Keycloak (revogar sessão, cadastrar pessoa).
// Usa o cliente "backend-admin" (conta de serviço) com permissões mínimas.
//
// SOBRE SENHAS: este arquivo NUNCA calcula nem guarda hash de senha. Quem faz isso
// é o Keycloak: ao receber uma senha pela API, ele sorteia um SALT aleatório para
// aquele usuário, calcula PBKDF2-SHA512 (210.000 iterações, ver passwordPolicy do
// realm) e grava só o hash + salt. Reimplementar isso na mão seria mais arriscado
// do que usar a solução consolidada.
// =============================================================================
import { randomBytes } from 'node:crypto'
import { config } from './config.js'

const { urlInterna, realm, adminClientId, adminClientSecret } = config.keycloak
const base = `${urlInterna}/admin/realms/${realm}`

let cache = { token: null, expiraEm: 0 }

// Pede ao Keycloak um token para o próprio gateway (fluxo client_credentials).
// Fica em cache até perto de expirar, para não pedir um novo a cada chamada.
async function tokenAdmin() {
  if (cache.token && Date.now() < cache.expiraEm - 10_000) return cache.token
  const r = await fetch(`${urlInterna}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: adminClientId,
      client_secret: adminClientSecret,
    }),
    signal: AbortSignal.timeout(3000),
  })
  if (!r.ok) throw new Error(`Keycloak recusou o token de administração (${r.status})`)
  const dados = await r.json()
  cache = { token: dados.access_token, expiraEm: Date.now() + dados.expires_in * 1000 }
  return cache.token
}

async function chamar(caminho, opcoes = {}) {
  const token = await tokenAdmin()
  return fetch(`${base}${caminho}`, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
  })
}

// Derruba TODAS as sessões do usuário. A partir daí a introspecção (auth.js)
// passa a responder "inativo" e o gateway recusa os tokens dele.
export async function revogarSessoes(usuarioId) {
  const r = await chamar(`/users/${encodeURIComponent(usuarioId)}/logout`, { method: 'POST' })
  if (!r.ok) throw new Error(`Falha ao revogar sessões (${r.status})`)
}

// Gera uma senha temporária aleatória (16 bytes de entropia). Os sufixos garantem
// que ela atenda a política do realm (maiúscula, número e caractere especial).
function senhaTemporaria() {
  return `${randomBytes(12).toString('base64url')}aA1!`
}

// Cadastro de pessoas (Tela 7): cria o usuário no Keycloak.
//  - a senha temporária é entregue ao Keycloak, que guarda só o hash com salt;
//  - "UPDATE_PASSWORD": no primeiro login a pessoa é obrigada a trocar a senha;
//  - "CONFIGURE_TOTP": e a cadastrar o autenticador (MFA).
export async function criarUsuario({ nome, sobrenome, email, perfis }) {
  const senha = senhaTemporaria()
  const criar = await chamar('/users', {
    method: 'POST',
    body: JSON.stringify({
      username: email,
      email,
      firstName: nome,
      lastName: sobrenome,
      enabled: true,
      requiredActions: ['UPDATE_PASSWORD', 'CONFIGURE_TOTP'],
      credentials: [{ type: 'password', value: senha, temporary: true }],
    }),
  })
  if (criar.status === 409) throw Object.assign(new Error('Já existe usuário com este e-mail'), { status: 409 })
  if (!criar.ok) throw new Error(`Falha ao criar usuário (${criar.status})`)

  // O Keycloak devolve o endereço do novo usuário no cabeçalho Location.
  const usuarioId = criar.headers.get('location').split('/').pop()

  // Atribui os perfis (roles). Primeiro busca cada perfil pelo nome para obter o id.
  const representacoes = []
  for (const nomePerfil of perfis) {
    const p = await chamar(`/roles/${encodeURIComponent(nomePerfil)}`)
    if (!p.ok) throw new Error(`Perfil inexistente: ${nomePerfil}`)
    representacoes.push(await p.json())
  }
  const mapear = await chamar(`/users/${usuarioId}/role-mappings/realm`, {
    method: 'POST',
    body: JSON.stringify(representacoes),
  })
  if (!mapear.ok) throw new Error(`Falha ao atribuir perfis (${mapear.status})`)

  // A senha temporária só existe aqui, nesta resposta. Entregue por canal seguro.
  return { usuarioId, senhaTemporaria: senha }
}
