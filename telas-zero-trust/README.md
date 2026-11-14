# Front-end da plataforma de autenticação federada Zero Trust

React 19 + Vite + Tailwind CSS 3. Agora **integrado ao backend**: o login é feito no Keycloak
(Authorization Code + PKCE) e as telas leem e gravam dados pelo gateway.

## Como rodar

1. Suba o backend (pasta `backend-zero-trust`): `docker compose up --build`.
   Keycloak em http://localhost:8080 e gateway em http://localhost:4000.
2. Aqui: `npm install` e `npm run dev`. Abra **http://localhost:5173**.
   A porta é fixa (`--strictPort`): o Keycloak só aceita voltar do login para esse endereço.

Para mudar endereços, copie `.env.example` para `.env`.

## Como a integração funciona

- **Login (Tela 1):** o botão leva à página de login do Keycloak, onde se digita a senha e o código MFA.
  O React nunca vê a senha. Na volta, a biblioteca `oidc-client-ts` troca o código pelos tokens (com PKCE),
  guarda a sessão no `sessionStorage` e renova o token antes de ele expirar (vale 5 minutos).
- **Todas as chamadas** passam por `src/api.js`: enviam o token e os controles da demonstração.
  Um `401` (sessão vencida ou revogada) leva de volta ao login com um aviso.
- **Um `403 acesso_negado`** do gateway leva à **Tela 4** com o motivo, a regra, o horário e o código da decisão.
  O botão "Solicitar acesso ao gestor" só aparece quando o motivo admite exceção (não aparece para dispositivo não confiável).

| Tela | Fonte dos dados |
|---|---|
| 1 Login | Keycloak (página dele) |
| 2 Portal | `GET /me` (nome e perfis); atalhos de gestor aparecem pelo perfil |
| 3 Financeiro | `GET /api/financeiro/lancamentos` |
| 4 Acesso negado | corpo do 403 do gateway |
| 5 Auditoria | `GET /admin/auditoria` e `POST /admin/sessoes/:id/revogar` |
| 6 Portal de RH | `GET /api/rh/pessoas` |
| 7 Cadastro | `POST /admin/pessoas` (a senha temporária aparece uma vez) |
| 8 Solicitar acesso | `POST /solicitacoes` |
| 9 Solicitações pendentes | `GET /solicitacoes` e `PATCH /solicitacoes/:id` |

## Barra azul de demonstração

- **Telas:** atalhos entre as telas (as 4 e 8 mostram um aviso se abertas sem um bloqueio anterior).
- **Dispositivo** (confiável ou não) e **Hora** (real, 10h ou 22h): o gateway lê esses dois controles para simular
  a postura do dispositivo e o horário. A hora simulada só funciona se o gateway estiver com `PERMITIR_SIMULACAO=true`
  (o `docker-compose.yml` já liga).
- Abra com `?semnav` para esconder a barra (ela volta depois do login, que recarrega a página).

## Roteiro de demonstração

Senha de todos os usuários de teste: `Senha@123`.

1. **maria.silva:** entra pelo Keycloak, abre o Financeiro (Hora: 10h) e vê os lançamentos. Com o dispositivo "Não confiável", cai na Tela 4 sem opção de exceção.
2. **joao.pereira:** abre o Financeiro, cai na Tela 4 (perfil sem permissão), preenche o pedido na Tela 8 e sai.
3. **fernanda.lima:** abre "Solicitações de acesso" e aprova o pedido do João. Volta como João com Hora 22h: agora entra (exceção temporária), mas não com dispositivo não confiável.
4. **carlos.lima:** abre o Painel de auditoria, vê todas as decisões e revoga a sessão da Maria. Ela cai no login com o aviso de sessão revogada.
5. **paulo.mendes:** abre o Portal de RH e cadastra uma pessoa. A conta nasce no Keycloak, que guarda só o hash da senha (com salt).

## Testes

- `npm test`: testes unitários dos mapeamentos (rápido, sem backend).
- `E2E=1 npm test`: acrescenta 7 testes de integração, que rodam o app inteiro contra o gateway **real**
  (precisa do backend no ar com `PERMITIR_SIMULACAO=true` e do banco zerado; os testes deixam dados lá).

## O que mudou em relação às telas de design (Sprint 2)

- **Login:** sem campos de e-mail, senha e MFA, que agora ficam na página do Keycloak.
- **Cadastro:** só nome, e-mail e acesso aos sistemas. CPF, nascimento, telefone, cargo e departamento saíram:
  não há onde guardar esses dados no backend, e não faz sentido coletá-los sem guardar.
  A opção "Gestor de TI" saiu: o backend não deixa o analista de RH conceder esse perfil.
- **Portal:** "Sua sessão" mostra perfil, dispositivo (simulado) e horário. "Expira em" e "último acesso" saíram: não há dado real.
- **Portal de RH:** "Solicitações recentes" virou a lista de pessoas, que vem da API.
- **Navegação:** não usa mais `#tela` na URL (o retorno do login a substituiria).

As telas originais seguem no HTML estático do protótipo da Sprint 2.

## Limitações

- O MFA (TOTP) e a tela de login do Keycloak não têm o visual do projeto (dá para criar um tema do Keycloak depois).
- A postura do dispositivo é simulada por cabeçalho; em produção viria de um agente confiável.
- Aprovar um pedido ainda não pede MFA, embora o desenho do projeto preveja.
- Qualquer gestor de área vê e decide pedidos de qualquer sistema.
- Sem `<StrictMode>` de propósito: em desenvolvimento ele duplicaria cada chamada e, com isso, os registros de auditoria.

## Estrutura

```
src/auth/oidc.js        login com o Keycloak (PKCE) e renovação do token
src/sessao.jsx          quem está logado, cliente da API, controles da demonstração
src/api.js              cliente do gateway (todas as chamadas)
src/mapeamentos.js      rótulos e conversões entre backend e telas
src/useProtegido.js     carrega dados de um sistema e leva à Tela 4 num 403
src/screens/            uma tela por arquivo
src/components/         ui.jsx (componentes) e RhLayout.jsx
src/testes/             testes unitários e de integração
```
