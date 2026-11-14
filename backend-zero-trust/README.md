# Backend da plataforma de autenticação federada Zero Trust

Protótipo do backend do Projeto Integrador Distributed and Secure Solutions.
Peças: **Keycloak** (identidade), **OPA** (decisão), **gateway** em Node.js (aplicação da decisão),
duas APIs de exemplo e **PostgreSQL** (auditoria). Tudo sobe com Docker Compose.

## Como as peças se encaixam

```
Navegador (React) ──token──> GATEWAY (PEP) ──pergunta──> OPA (PDP)
      │                         │  │                        regras em opa/policies/
      │ login + MFA             │  └─ registra a decisão ─> PostgreSQL (auditoria)
      ▼                         │
  KEYCLOAK (IdP) <── confere ───┘  se permitido ──> API Financeiro / API RH
  emite o token                                   (só o gateway chega até elas)
```

Cada requisição a um sistema passa por: **autenticar** (assinatura + validade + token não revogado)
→ **perguntar ao OPA** → **registrar a decisão** → **aplicar** (403 ou repassar). É o Diagrama 4.

## Como rodar

Precisa de Docker e Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

- Keycloak: http://localhost:8080 (console: admin / admin)
- Gateway: http://localhost:4000 (única porta de entrada dos sistemas)

Na primeira subida o Keycloak leva cerca de 30 segundos para ficar pronto.
Com tudo no ar, o roteiro `testes/demo.sh` (precisa de `curl` e `jq`) mostra login único,
bloqueios, auditoria e revogação passo a passo.

Usuários de teste (senha `Senha@123`): maria.silva, joao.pereira, paulo.mendes, fernanda.lima, carlos.lima.
Detalhes dos perfis em `keycloak/LEIA-ME.md`.

## Endpoints do gateway

Todos exigem `Authorization: Bearer <token>`.

| Rota | Quem pode | O que faz |
|---|---|---|
| `GET /api/financeiro/*` | perfil `acesso_financeiro` | Repassa ao Sistema Financeiro (se a política permitir) |
| `GET /api/rh/*` | `acesso_rh` ou `analista_rh` | Repassa ao Portal de RH (se a política permitir) |
| `GET /me` | qualquer autenticado | Nome, perfis e quando a sessão expira: Tela 2 |
| `GET /admin/auditoria` | `gestor_ti` | Lista decisões (filtros `usuario`, `sistema` = `financeiro`\|`rh`, `decisao` = `Permitido`\|`Negado`), com `motivosTexto` e `regras`: Tela 5 |
| `POST /admin/sessoes/:usuarioId/revogar` | `gestor_ti` | Derruba as sessões do usuário |
| `POST /admin/pessoas` | `analista_rh` | Cadastra pessoa no Keycloak: Tela 7. Corpo: `{nome, sobrenome, email, perfis}`; só concede `acesso_financeiro`, `acesso_rh` e `gestor_area` (nunca `gestor_ti` nem `analista_rh`, para não haver escalada de privilégio) |
| `POST /solicitacoes` | qualquer autenticado | Pede acesso temporário: Tela 8. Corpo: `{codigoDecisao, justificativa, periodoHoras}` (1, 4, 24 ou 72). O sistema e o motivo vêm da decisão registrada, que precisa ser sua, ter sido negada e admitir exceção |
| `GET /solicitacoes` | `gestor_area`, `gestor_ti` | Lista pedidos (padrão: pendentes): Tela 9 |
| `PATCH /solicitacoes/:id` | `gestor_area` | `{"decisao":"aprovada"\|"negada"}`; aprovar cria exceção temporária no OPA. Ninguém decide o próprio pedido |

Quando o acesso é negado, a resposta é **403** com `codigoDecisao` (o "D-0038" da Tela 4),
`motivos` (textos), `regras` (nome da regra), `momento` e `permiteExcecao` (se a Tela 4 deve mostrar "Solicitar acesso ao gestor").

### Cabeçalhos que o front envia

- `X-Device-Posture: confiavel` — postura do dispositivo, **simulada** no protótipo. Sem ele, o gateway nega.
- `X-Simular-Hora: 22` — só para demonstrar "fora do horário". **Desligado por padrão** (`PERMITIR_SIMULACAO`); o `docker-compose.yml` liga para a demo. Ligado, qualquer usuário burla a regra de horário.

## A política (OPA)

`opa/policies/acesso.rego` tem as regras, com comentários linha a linha, e `data.json` tem os parâmetros
(perfis por sistema, horário das 7h às 20h). **Negar por padrão**: dado ausente = negado.
Exceção temporária contorna perfil e horário, **nunca** dispositivo não confiável.

Testes da política (10 casos), com o [OPA](https://www.openpolicyagent.org/docs/latest/#running-opa) instalado:

```bash
opa test opa/policies opa/testes -v
```

## Senhas: hash com salt

- **O gateway não guarda senha nem calcula hash.** Isso fica com o Keycloak, que para cada usuário sorteia um
  **salt** aleatório e grava **PBKDF2-SHA512 com 210.000 iterações** (política do realm).
- O arquivo `keycloak/realm-aurora.json` não tem senha em texto puro: o script `keycloak/gerar-realm.py`
  gera, para cada usuário de teste, um salt novo de 16 bytes e o hash PBKDF2 antes de gravar. Ele roda um
  autoteste (a senha certa confere, a errada não).
- O cadastro de pessoas (`POST /admin/pessoas`) entrega uma senha temporária aleatória ao Keycloak, que faz
  o hash com salt; a pessoa é obrigada a trocá-la e a configurar o MFA no primeiro login.
- Evitamos reimplementar criptografia à mão: usar a solução consolidada é a escolha da metodologia do projeto.

Para trocar as senhas de teste: `SENHA_TESTE='Outra@123' python3 keycloak/gerar-realm.py` e suba o Keycloak de novo
(se já subiu antes, apague o volume ou o container para reimportar o realm).

## O que foi testado 

Testado de verdade, fora do Docker, com **Keycloak 26.0.7 real** (mesma versão do compose), **PostgreSQL 16 real** e **OPA 1.0.0 real**:
- Política Rego: 10/10 testes.
- Importação do realm com as senhas em hash PBKDF2-SHA512 + salt: os 5 usuários logam, senha errada é recusada.
- Gateway ponta a ponta: SSO entre os dois sistemas, bloqueio por perfil/horário/dispositivo, falha fechada com OPA fora do ar,
  token adulterado, auditoria no Postgres, solicitação + exceção temporária, cadastro de pessoas (credencial criada pelo Keycloak
  com `pbkdf2-sha512`, 210.000 iterações, MFA obrigatório) e revogação de sessão (introspecção real).
- `db/init.sql` aplicado do zero.
- Fluxo de login do navegador (Authorization Code + PKCE) do cliente `portal-web`: código gerado e trocado por tokens, token aceito pelo gateway, renovação por refresh token, verifier errado e pedido sem `code_challenge` recusados, logout devolvendo ao front.
- O front React (pasta `telas-zero-trust`) contra este gateway: 7 testes de integração passando.

Para rodar o gateway sem Docker, com o Keycloak falso e sem banco (auditoria em memória):

```bash
cd gateway && npm install
node testes/keycloak-falso.mjs      # terminal 1
# terminal 2: opa run --server opa/policies | terminal 3/4: APIs com PORT=3001 e PORT=3002
KEYCLOAK_INTERNAL_URL=http://localhost:18080 KEYCLOAK_PUBLIC_URL=http://localhost:18080 \
API_FINANCEIRO_URL=http://localhost:3001 API_RH_URL=http://localhost:3002 npm start
curl http://localhost:18080/mint/maria.silva     # token de teste
```

## Limitações conhecidas (é um protótipo)

- Keycloak em modo `start-dev`, HTTP, `demo-cli` com senha direta: **só desenvolvimento**. Remova o `demo-cli` depois dos testes.
- Postura do dispositivo simulada por cabeçalho; em produção viria de um agente/MDM confiável.
- As exceções temporárias ficam na memória do OPA e somem se ele reiniciar.
- Aprovar um pedido exige MFA no desenho do projeto, mas o protótipo ainda não faz essa confirmação extra.
- A aprovação grava a decisão e depois cria a exceção; em produção as duas coisas iriam numa transação.
- Troque `ADMIN_CLIENT_SECRET` e as senhas antes de qualquer uso fora da sua máquina e não envie o `.env` ao GitHub.

## Ligando o front React

O front já está integrado (pasta `telas-zero-trust`, ver o README dele). Resumo do que ele faz:

1. Login com **Authorization Code + PKCE** no cliente `portal-web` (por exemplo com a biblioteca `oidc-client-ts`),
   apontando para `http://localhost:8080/realms/aurora`.
2. Chame o gateway com `Authorization: Bearer <access_token>` e o cabeçalho `X-Device-Posture`.
3. Em um 403, leia `motivos`, `codigoDecisao` e `permiteExcecao` para montar a Tela 4.

## Estrutura

```
docker-compose.yml        sobe todos os serviços
keycloak/                 gerar-realm.py (gera o realm com senhas em hash+salt), realm-aurora.json, LEIA-ME.md
opa/policies/             acesso.rego (regras) e data.json (parâmetros)
opa/testes/               testes da política
gateway/src/              config, auth, admin, pdp, armazenamento, index (cada arquivo tem o cabeçalho explicando o papel)
gateway/testes/           keycloak-falso.mjs (testar sem Docker)
api-financeiro, api-rh    sistemas protegidos de exemplo
db/init.sql               tabelas de auditoria e solicitações
testes/demo.sh            roteiro de demonstração com curl
```
