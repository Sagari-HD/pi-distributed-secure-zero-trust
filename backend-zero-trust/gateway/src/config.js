// =============================================================================
// config.js: todas as configurações do gateway num lugar só.
// Os valores vêm de variáveis de ambiente (definidas no docker-compose.yml).
// Os valores depois do "??" são os padrões para rodar fora do Docker.
// =============================================================================
const env = process.env

const keycloak = {
  // URL pela qual o gateway ENXERGA o Keycloak (dentro do Docker é "keycloak").
  urlInterna: env.KEYCLOAK_INTERNAL_URL ?? 'http://localhost:8080',
  // URL que aparece no campo "iss" dos tokens (a que o navegador usou para logar).
  urlPublica: env.KEYCLOAK_PUBLIC_URL ?? 'http://localhost:8080',
  realm: env.KEYCLOAK_REALM ?? 'aurora',
  // Cliente "backend-admin": confere se o token foi revogado e usa a API de administração.
  adminClientId: env.ADMIN_CLIENT_ID ?? 'backend-admin',
  adminClientSecret: env.ADMIN_CLIENT_SECRET ?? 'troque-este-segredo',
}
// Quem emitiu o token. O gateway só aceita tokens com este emissor.
keycloak.emissor = `${keycloak.urlPublica}/realms/${keycloak.realm}`

export const config = {
  porta: Number(env.PORT ?? 4000),
  keycloak,
  opaUrl: env.OPA_URL ?? 'http://localhost:8181', // endereço do PDP
  // Se DATABASE_URL não for definida, auditoria e solicitações ficam só em memória
  // (útil para testes rápidos; os dados somem ao reiniciar).
  databaseUrl: env.DATABASE_URL,
  // Para onde cada sistema protegido está (só o gateway chega até eles).
  sistemas: {
    financeiro: env.API_FINANCEIRO_URL ?? 'http://localhost:3001',
    rh: env.API_RH_URL ?? 'http://localhost:3002',
  },
  origemPermitida: env.FRONTEND_URL ?? 'http://localhost:5173', // CORS do front React
  fusoHorario: env.TZ_NEGOCIO ?? 'America/Sao_Paulo',
  // Permite simular o horário por cabeçalho (X-Simular-Hora) nas demonstrações.
  // DESLIGADO por padrão: com isso ligado qualquer usuário consegue burlar a regra
  // de horário. O docker-compose.yml liga só para a demonstração do protótipo.
  permitirSimulacao: env.PERMITIR_SIMULACAO === 'true',
}
