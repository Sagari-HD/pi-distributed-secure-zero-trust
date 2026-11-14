#!/usr/bin/env python3
"""
Gera o arquivo keycloak/realm-aurora.json (o realm importado pelo Keycloak).

POR QUE ESTE SCRIPT EXISTE
--------------------------
O arquivo do realm vai para o GitHub. Se ele tivesse as senhas em texto puro,
qualquer pessoa com acesso ao repositório leria as senhas. Por isso aqui as senhas
já são transformadas em HASH COM SALT antes de entrar no arquivo.

COMO O HASH É FEITO (técnica do "salt")
---------------------------------------
1. Sorteia um SALT: 16 bytes aleatórios, DIFERENTE para cada usuário.
   Dois usuários com a mesma senha terminam com hashes completamente diferentes,
   e tabelas pré-calculadas (rainbow tables) deixam de funcionar.
2. Aplica PBKDF2-HMAC-SHA512 sobre (senha + salt) com 210.000 iterações.
   As iterações deixam cada tentativa de adivinhar a senha propositalmente lenta.
3. Guarda o hash e o salt (nunca a senha), no mesmo formato que o próprio Keycloak
   usa internamente (campos secretData e credentialData).

Quando um usuário é criado ou troca a senha DENTRO do Keycloak (inclusive pela API
de administração usada no cadastro de pessoas), o Keycloak faz exatamente isso
sozinho: gera salt aleatório e salva o hash PBKDF2. Este script só faz o mesmo para
os usuários de teste que já nascem no arquivo.

USO
---
    python3 keycloak/gerar-realm.py
    SENHA_TESTE='OutraSenha@1' ADMIN_CLIENT_SECRET='segredo' python3 keycloak/gerar-realm.py

PLANO B (se o Keycloak não aceitar o login dos usuários importados)
------------------------------------------------------------------
    SENHA_EM_TEXTO=1 python3 keycloak/gerar-realm.py
Gera o arquivo com a senha em texto puro; o Keycloak então sorteia o salt e faz o hash
sozinho ao importar. Use SÓ no seu computador e NÃO envie esse arquivo ao GitHub.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

ALGORITMO = "pbkdf2-sha512"   # nome do algoritmo como o Keycloak o identifica
ITERACOES = 210_000           # custo do hash (recomendação OWASP para PBKDF2-SHA512)
TAMANHO_SALT = 16             # bytes de salt aleatório por usuário
TAMANHO_HASH = 64             # 512 bits, o tamanho usado pelo pbkdf2-sha512 do Keycloak

SENHA_TESTE = os.environ.get("SENHA_TESTE", "Senha@123")
SEGREDO_ADMIN = os.environ.get("ADMIN_CLIENT_SECRET", "troque-este-segredo")
SENHA_EM_TEXTO = os.environ.get("SENHA_EM_TEXTO") == "1"  # plano B (ver o topo do arquivo)


def b64(dados: bytes) -> str:
    return base64.b64encode(dados).decode("ascii")


def gerar_credencial(senha: str) -> dict:
    """Cria a credencial de senha (hash + salt) no formato de importação do Keycloak."""
    salt = secrets.token_bytes(TAMANHO_SALT)  # salt novo e aleatório a cada chamada
    hash_ = hashlib.pbkdf2_hmac("sha512", senha.encode("utf-8"), salt, ITERACOES, dklen=TAMANHO_HASH)
    return {
        "type": "password",
        "userLabel": "senha de teste",
        "createdDate": int(time.time() * 1000),
        # secretData: o que protege a senha (hash + salt). Não contém a senha.
        "secretData": json.dumps(
            {"value": b64(hash_), "salt": b64(salt), "additionalParameters": {}},
            separators=(",", ":"),
        ),
        # credentialData: como o hash foi feito (para o Keycloak saber conferir depois).
        "credentialData": json.dumps(
            {"hashIterations": ITERACOES, "algorithm": ALGORITMO, "additionalParameters": {}},
            separators=(",", ":"),
        ),
    }


def verificar(senha: str, credencial: dict) -> bool:
    """Autoteste: refaz o hash com o salt guardado e compara em tempo constante."""
    segredo = json.loads(credencial["secretData"])
    dados = json.loads(credencial["credentialData"])
    refeito = hashlib.pbkdf2_hmac(
        "sha512", senha.encode("utf-8"), base64.b64decode(segredo["salt"]),
        dados["hashIterations"], dklen=TAMANHO_HASH,
    )
    return hmac.compare_digest(refeito, base64.b64decode(segredo["value"]))


def usuario(login, nome, sobrenome, perfis):
    return {
        "username": login,
        "email": f"{login}@aurora.example",
        "firstName": nome,
        "lastName": sobrenome,
        "enabled": True,
        "emailVerified": True,
        "realmRoles": perfis,
        "credentials": [
            {"type": "password", "value": SENHA_TESTE, "temporary": False}
            if SENHA_EM_TEXTO
            else gerar_credencial(SENHA_TESTE)
        ],
    }


realm = {
    "realm": "aurora",
    "displayName": "Aurora Holdings",
    "enabled": True,
    "sslRequired": "none",                 # só para desenvolvimento local (HTTP)
    "registrationAllowed": False,
    "loginWithEmailAllowed": True,
    "duplicateEmailsAllowed": False,
    "accessTokenLifespan": 300,            # token de acesso vale 5 min (curto de propósito)
    "ssoSessionIdleTimeout": 1800,
    "ssoSessionMaxLifespan": 36000,
    # Política para senhas NOVAS (criadas ou trocadas depois da importação):
    #  - mínimo de 8 caracteres, com maiúscula, número e caractere especial;
    #  - não pode ser igual ao nome de usuário;
    #  - hash PBKDF2-SHA512 com 210.000 iterações (o salt é aleatório automaticamente).
    "passwordPolicy": (
        "length(8) and upperCase(1) and digits(1) and specialChars(1) and notUsername(undefined)"
        f" and hashAlgorithm({ALGORITMO}) and hashIterations({ITERACOES})"
    ),
    # Proteção contra tentativa e erro: 5 falhas seguidas bloqueiam temporariamente.
    "bruteForceProtected": True,
    "failureFactor": 5,
    "waitIncrementSeconds": 60,
    "maxFailureWaitSeconds": 900,
    "roles": {
        "realm": [
            {"name": "acesso_financeiro", "description": "Pode usar o Sistema Financeiro"},
            {"name": "acesso_rh", "description": "Pode usar o Portal de RH"},
            {"name": "analista_rh", "description": "Cadastra pessoas no RH"},
            {"name": "gestor_area", "description": "Aprova pedidos de acesso da sua área"},
            {"name": "gestor_ti", "description": "Consulta a auditoria e revoga sessões"},
        ]
    },
    "clients": [
        {   # Front React: login pelo navegador com Authorization Code + PKCE.
            "clientId": "portal-web",
            "publicClient": True,
            "standardFlowEnabled": True,
            "directAccessGrantsEnabled": False,
            "redirectUris": ["http://localhost:5173/*"],
            "webOrigins": ["http://localhost:5173"],
            "attributes": {
                "pkce.code.challenge.method": "S256",          # exige PKCE com SHA-256
                "post.logout.redirect.uris": "http://localhost:5173/*",  # para onde voltar depois do logout
            },
        },
        {   # SÓ PARA TESTES com curl (testes/demo.sh). Remova depois dos testes.
            "clientId": "demo-cli",
            "publicClient": True,
            "standardFlowEnabled": False,
            "directAccessGrantsEnabled": True,
        },
        {   # Usado pelo gateway: checar token revogado, derrubar sessões, criar usuários.
            "clientId": "backend-admin",
            "publicClient": False,
            "secret": SEGREDO_ADMIN,
            "serviceAccountsEnabled": True,
            "standardFlowEnabled": False,
            "directAccessGrantsEnabled": False,
        },
    ],
    "users": [
        usuario("maria.silva", "Maria", "Silva", ["acesso_financeiro", "acesso_rh"]),
        usuario("joao.pereira", "João", "Pereira", ["acesso_rh"]),
        usuario("paulo.mendes", "Paulo", "Mendes", ["analista_rh", "acesso_rh"]),
        usuario("fernanda.lima", "Fernanda", "Lima", ["gestor_area", "acesso_financeiro"]),
        usuario("carlos.lima", "Carlos", "Lima", ["gestor_ti", "acesso_rh", "acesso_financeiro"]),
        {   # Conta de serviço do cliente backend-admin, com as permissões mínimas que ele precisa.
            "username": "service-account-backend-admin",
            "enabled": True,
            "serviceAccountClientId": "backend-admin",
            "clientRoles": {"realm-management": ["manage-users", "view-users", "query-users", "view-realm"]},
        },
    ],
}

if __name__ == "__main__":
    # Autoteste: toda credencial gerada precisa conferir com a senha original.
    for u in realm["users"]:
        for c in u.get("credentials", []):
            if SENHA_EM_TEXTO:
                continue
            assert verificar(SENHA_TESTE, c), f"hash inválido para {u['username']}"
            assert not verificar(SENHA_TESTE + "x", c), "hash aceitou senha errada"

    caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)), "realm-aurora.json")
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(realm, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Gerado: {caminho}")
    print("Usuários com senha em hash PBKDF2-SHA512 + salt único:")
    for u in realm["users"]:
        for c in u.get("credentials", []):
            if SENHA_EM_TEXTO:
                print(f"  {u['username']:<16} (texto puro: plano B, não envie ao GitHub)")
            else:
                salt = json.loads(c["secretData"])["salt"]
                print(f"  {u['username']:<16} salt={salt}")
