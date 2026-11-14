// =============================================================================
// auth/oidc.js: login com o Keycloak pelo fluxo Authorization Code + PKCE.
//
// Como funciona:
//  1. entrar()   -> o navegador vai para a página de login do Keycloak (é lá que a
//                   pessoa digita senha e código MFA; o React nunca vê a senha);
//  2. Keycloak   -> devolve para "/" com ?code=...&state=...;
//  3. iniciar()  -> troca o código pelos tokens (com o PKCE, que impede usar um código
//                   interceptado) e guarda a sessão no sessionStorage;
//  4. o token é renovado sozinho (automaticSilentRenew) antes de expirar.
// A interface "autenticador" (iniciar, entrar, sair, obterToken, limpar) existe para
// os testes poderem trocar este arquivo por um autenticador falso.
// =============================================================================
import { UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { config } from '../config.js'

export function criarAutenticadorOidc(cfg = config) {
  const manager = new UserManager({
    authority: `${cfg.keycloakUrl}/realms/${cfg.realm}`,
    client_id: cfg.clientId,
    redirect_uri: `${window.location.origin}/`,
    post_logout_redirect_uri: `${window.location.origin}/`,
    response_type: 'code', // com cliente público, a biblioteca aplica o PKCE (S256) sozinha
    scope: 'openid profile',
    automaticSilentRenew: true, // renova com o refresh token; o token de acesso dura só 5 min
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  })

  let inicio // guarda a promessa: o React em modo dev chama duas vezes, e o código só pode ser trocado uma

  return {
    // Devolve true se há sessão válida (já existente ou recém-criada pelo retorno do Keycloak).
    iniciar() {
      inicio ??= (async () => {
        const params = new URLSearchParams(window.location.search)
        if (params.has('code') && params.has('state')) {
          await manager.signinRedirectCallback()
          window.history.replaceState({}, '', window.location.pathname) // limpa o código da URL
        }
        const usuario = await manager.getUser()
        return Boolean(usuario && !usuario.expired)
      })()
      return inicio
    },
    entrar: () => manager.signinRedirect(),
    sair: () => manager.signoutRedirect(),
    async obterToken() {
      const usuario = await manager.getUser()
      if (!usuario) throw new Error('sem sessão')
      return usuario.access_token
    },
    limpar: () => manager.removeUser(), // esquece a sessão local (ex.: depois de um 401)
  }
}
