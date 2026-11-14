#!/usr/bin/env bash
# =============================================================================
# Roteiro de demonstração do backend completo (precisa do ambiente no ar:
#   docker compose up --build) e dos programas curl e jq instalados.
# Cada passo mostra o que se espera. Usa o cliente "demo-cli" do Keycloak, que
# aceita login por senha direta SÓ para testes.
# =============================================================================
set -uo pipefail
KC=${KC:-http://localhost:8080}
GW=${GW:-http://localhost:4000}
SENHA=${SENHA:-Senha@123}

# Faz login por senha e devolve o token de acesso do usuário.
token() {
  curl -s -X POST "$KC/realms/aurora/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=demo-cli -d "username=$1" \
    --data-urlencode "password=$SENHA" | jq -r .access_token
}
# Chama o gateway e mostra o código HTTP + corpo. Uso: chamar TOKEN URL [cabeçalhos...]
chamar() {
  local tk=$1 url=$2; shift 2
  curl -s -o /tmp/resp.json -w "HTTP %{http_code}\n" -H "Authorization: Bearer $tk" "$@" "$GW$url"
  jq -c . /tmp/resp.json 2>/dev/null | cut -c1-220
  echo
}
titulo() { echo "=== $* ==="; }

MARIA=$(token maria.silva); JOAO=$(token joao.pereira); CARLOS=$(token carlos.lima)
[ -n "$MARIA" ] && [ "$MARIA" != "null" ] || { echo "Falha no login. O Keycloak já terminou de subir?"; exit 1; }

titulo "1. Maria, Financeiro, dentro do horário, dispositivo confiável (esperado: 200)"
chamar "$MARIA" /api/financeiro/lancamentos -H "X-Device-Posture: confiavel" -H "X-Simular-Hora: 10"

titulo "2. SSO: o MESMO token abre o Portal de RH sem novo login (esperado: 200)"
chamar "$MARIA" /api/rh/pessoas -H "X-Device-Posture: confiavel" -H "X-Simular-Hora: 10"

titulo "3. Dispositivo não confiável (esperado: 403 dispositivo_nao_confiavel, permiteExcecao=false)"
chamar "$MARIA" /api/financeiro/lancamentos -H "X-Device-Posture: nao_confiavel" -H "X-Simular-Hora: 10"

titulo "4. Fora do horário (esperado: 403 fora_do_horario, permiteExcecao=true)"
chamar "$MARIA" /api/financeiro/lancamentos -H "X-Device-Posture: confiavel" -H "X-Simular-Hora: 22"

titulo "5. João não tem perfil do Financeiro (esperado: 403 perfil_sem_permissao)"
chamar "$JOAO" /api/financeiro/lancamentos -H "X-Device-Posture: confiavel" -H "X-Simular-Hora: 10"

titulo "6. Sem token (esperado: 401)"
curl -s -o /dev/null -w "HTTP %{http_code}\n\n" "$GW/api/financeiro/lancamentos"

titulo "7. Auditoria vista pelo gestor de TI (esperado: 200 com as decisões acima)"
chamar "$CARLOS" /admin/auditoria

titulo "8. Revogação: o gestor derruba a sessão da Maria e o token dela deixa de valer"
MARIA_ID=$(curl -s -H "Authorization: Bearer $CARLOS" "$GW/admin/auditoria?usuario=Maria" | jq -r '.[0].usuarioId')
curl -s -o /dev/null -w "revogar: HTTP %{http_code} (esperado 204)\n" -X POST -H "Authorization: Bearer $CARLOS" "$GW/admin/sessoes/$MARIA_ID/revogar"
chamar "$MARIA" /api/rh/pessoas -H "X-Device-Posture: confiavel" -H "X-Simular-Hora: 10"
echo "(esperado acima: HTTP 401 nao_autenticado)"
