// =============================================================================
// KEYCLOAK FALSO: serve só para testar o gateway SEM Docker.
// Imita os endereços do Keycloak que o gateway usa (chaves públicas, introspecção,
// token de administração, logout e criação de usuário) e emite tokens assinados.
//
//   Uso (dentro da pasta gateway, depois de "npm install"):
//     node testes/keycloak-falso.mjs
//   Pegar um token de teste:   curl http://localhost:18080/mint/maria.silva
//
// NÃO É SEGURO e não substitui o Keycloak de verdade. Só para desenvolvimento.
// =============================================================================
import http from 'node:http'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'

const porta = Number(process.env.KC_FALSO_PORTA ?? 18080)
const emissor = `http://localhost:${porta}/realms/aurora`

// Par de chaves gerado a cada execução; a chave pública é publicada no JWKS.
const { publicKey, privateKey } = await generateKeyPair('RS256')
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }

const usuarios = {
  'maria.silva': { nome: 'Maria Silva', perfis: ['acesso_financeiro', 'acesso_rh'] },
  'joao.pereira': { nome: 'João Pereira', perfis: ['acesso_rh'] },
  'paulo.mendes': { nome: 'Paulo Mendes', perfis: ['analista_rh', 'acesso_rh'] },
  'fernanda.lima': { nome: 'Fernanda Lima', perfis: ['gestor_area', 'acesso_financeiro'] },
  'carlos.lima': { nome: 'Carlos Lima', perfis: ['gestor_ti', 'acesso_rh', 'acesso_financeiro'] },
}
const tokensEmitidos = new Map() // token -> id do usuário
const sessoesRevogadas = new Set() // ids de usuários com sessão derrubada

async function emitirToken(login) {
  const u = usuarios[login]
  const token = await new SignJWT({ preferred_username: login, name: u.nome, realm_access: { roles: u.perfis } })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject(`u-${login}`)
    .setIssuer(emissor)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)
  tokensEmitidos.set(token, `u-${login}`)
  return token
}

const lerCorpo = (req) => new Promise((ok) => {
  let texto = ''
  req.on('data', (c) => (texto += c))
  req.on('end', () => ok(texto))
})
const json = (res, status, corpo, cabecalhos = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...cabecalhos })
  res.end(JSON.stringify(corpo))
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${porta}`)
  const corpo = req.method === 'POST' ? await lerCorpo(req) : ''

  if (pathname.endsWith('/protocol/openid-connect/certs')) return json(res, 200, { keys: [jwk] })

  if (pathname.endsWith('/token/introspect')) {
    const token = new URLSearchParams(corpo).get('token')
    const dono = tokensEmitidos.get(token)
    return json(res, 200, { active: Boolean(dono) && !sessoesRevogadas.has(dono) })
  }

  if (pathname.endsWith('/protocol/openid-connect/token')) {
    return json(res, 200, { access_token: 'admin-falso', expires_in: 300 })
  }

  if (pathname.startsWith('/mint/')) {
    const login = decodeURIComponent(pathname.slice(6))
    if (!usuarios[login]) return json(res, 404, { erro: 'usuário de teste inexistente' })
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    return res.end(await emitirToken(login))
  }

  // A partir daqui são as rotas de administração: exigem o token de admin.
  if (pathname.startsWith('/admin/') && req.headers.authorization !== 'Bearer admin-falso') {
    return json(res, 401, { erro: 'sem token de admin' })
  }
  let m
  if ((m = pathname.match(/\/users\/([^/]+)\/logout$/)) && req.method === 'POST') {
    sessoesRevogadas.add(decodeURIComponent(m[1]))
    res.writeHead(204); return res.end()
  }
  if (pathname.endsWith('/users') && req.method === 'POST') {
    const novo = JSON.parse(corpo)
    if (novo.username === 'ja.existe@aurora.example') return json(res, 409, { erro: 'existe' })
    console.log('[keycloak-falso] usuário criado:', novo.username, '| exige:', novo.requiredActions)
    res.writeHead(201, { Location: `http://localhost:${porta}/admin/realms/aurora/users/novo-123` })
    return res.end()
  }
  if ((m = pathname.match(/\/roles\/([^/]+)$/))) return json(res, 200, { id: `r-${m[1]}`, name: m[1] })
  if (pathname.endsWith('/role-mappings/realm') && req.method === 'POST') {
    res.writeHead(204); return res.end()
  }
  return json(res, 404, { erro: 'rota não imitada', pathname })
}).listen(porta, () => console.log(`Keycloak falso em http://localhost:${porta}`))
