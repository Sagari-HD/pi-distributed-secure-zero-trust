// =============================================================================
// config.js: endereços do Keycloak e do gateway (ver .env.example para mudar).
// =============================================================================
const env = import.meta.env

export const config = {
  keycloakUrl: env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080',
  realm: env.VITE_KEYCLOAK_REALM ?? 'aurora',
  clientId: env.VITE_KEYCLOAK_CLIENT_ID ?? 'portal-web', // cliente público com PKCE no Keycloak
  gatewayUrl: env.VITE_GATEWAY_URL ?? 'http://localhost:4000',
}
