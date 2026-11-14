# Keycloak: o que tem no `realm-aurora.json`

JSON não aceita comentários, então a explicação fica aqui. **Não edite o JSON na mão:**
ele é gerado por `python3 keycloak/gerar-realm.py` (o script tem os comentários).

## Senhas: hash com salt

O arquivo não tem nenhuma senha em texto puro. Para cada usuário o script:

1. sorteia um **salt** de 16 bytes, diferente para cada pessoa;
2. calcula **PBKDF2-HMAC-SHA512** (210.000 iterações) sobre senha + salt;
3. grava só o hash e o salt (`secretData`) e como o hash foi feito (`credentialData`).

Duas pessoas com a mesma senha ficam com hashes diferentes, e tabelas prontas de
senhas (rainbow tables) não servem. Depois da importação, tudo que o Keycloak
cria (cadastro de pessoas, troca de senha) segue o mesmo padrão automaticamente,
conforme a `passwordPolicy` do realm.

Se o login dos usuários importados falhar, use o plano B: `SENHA_EM_TEXTO=1 python3 keycloak/gerar-realm.py`
(não envie esse arquivo ao GitHub) e suba o Keycloak de novo.

## Realm `aurora`

- `sslRequired: none`: permite HTTP. Só para desenvolvimento local.
- `accessTokenLifespan: 300`: o token vale 5 minutos. Token curto reduz o estrago se for roubado.
- `passwordPolicy`: mínimo de 8 caracteres com maiúscula, número e especial; diferente do usuário; hash PBKDF2-SHA512 com 210.000 iterações.
- `bruteForceProtected`: 5 falhas seguidas bloqueiam o login por um tempo.
- **Perfis (roles)**: `acesso_financeiro`, `acesso_rh`, `analista_rh`, `gestor_area`, `gestor_ti`.
  Eles vão dentro do token (`realm_access.roles`) e o OPA os usa na decisão.

## Clientes

| clientId | Tipo | Para que serve |
|---|---|---|
| `portal-web` | público, Authorization Code + **PKCE (S256)** | O front React. Login pelo navegador. |
| `demo-cli` | público, senha direta | **Só para testes por curl** (`testes/demo.sh`). Remova depois. |
| `backend-admin` | confidencial, conta de serviço | O gateway usa para checar token revogado, derrubar sessões e criar usuários. |

## Usuários de teste (senha de todos: `Senha@123`, só para desenvolvimento)

| Login | Perfis | Papel |
|---|---|---|
| `maria.silva` | acesso_financeiro, acesso_rh | Colaboradora do Financeiro |
| `joao.pereira` | acesso_rh | Sem acesso ao Financeiro |
| `paulo.mendes` | analista_rh, acesso_rh | Analista de RH (cadastra pessoas) |
| `fernanda.lima` | gestor_area, acesso_financeiro | Gestora de área (aprova pedidos) |
| `carlos.lima` | gestor_ti, acesso_rh, acesso_financeiro | Gestor de TI (auditoria e revogação) |

## Ligando o MFA

No console (http://localhost:8080, admin/admin), realm `aurora`: **Authentication → Required actions**
e deixe **Configure OTP** como *Set as default action*. No primeiro login cada usuário cadastra o app
autenticador. Pessoas criadas pelo cadastro do gateway já nascem obrigadas a configurar o MFA.
Com isso o `demo-cli` (senha direta) deixa de funcionar para esses usuários; teste por curl antes de ligar.
