# =============================================================================
# POLÍTICA DE ACESSO ZERO TRUST: este arquivo é o PDP (Policy Decision Point).
#
# O gateway (PEP) pergunta ao OPA, a cada requisição:
#     "este usuário pode usar este sistema agora, deste dispositivo?"
# e o OPA responde com a regra "decisao", por exemplo:
#     { "permitido": false, "motivos": ["fora_do_horario"] }
#
# Os parâmetros (quais perfis acessam cada sistema, e o horário permitido) ficam
# em data.json, na mesma pasta. Para mudar uma regra de negócio, mexe-se ali ou
# neste arquivo, sem tocar no código do gateway.
#
# O que o gateway envia em "input":
#   input.usuario.id        identificador do usuário (campo "sub" do token)
#   input.usuario.perfis    lista de perfis do token (ex.: ["acesso_financeiro"])
#   input.sistema           "financeiro" ou "rh"
#   input.hora              hora cheia (0 a 23) no fuso da empresa
#   input.dispositivo       postura do dispositivo ("confiavel" ou outro valor)
#   input.agora_epoch       momento atual em segundos (para validar exceções)
#
# Exceções temporárias (aprovadas por um gestor) chegam em data.excecoes.<usuario>.<sistema>,
# com o instante em que expiram. Ver módulo de solicitações do gateway.
# =============================================================================
package zerotrust.acesso

import rego.v1

# Regra de ouro do Zero Trust: NEGAR POR PADRÃO.
# Só vira "true" se nenhum motivo de negação for encontrado.
default permitido := false

permitido if count(motivos) == 0

# --- Motivos de negação ------------------------------------------------------
# Cada bloco abaixo adiciona um motivo ao conjunto "motivos" quando a condição vale.

# 1) O usuário não tem um perfil autorizado para este sistema.
#    Uma exceção temporária válida contorna este motivo.
motivos contains "perfil_sem_permissao" if {
	not perfil_autorizado
	not excecao_valida
}

# 2) Fora do horário permitido do sistema.
#    Uma exceção temporária válida também contorna este motivo.
motivos contains "fora_do_horario" if {
	not dentro_do_horario
	not excecao_valida
}

# 3) Dispositivo não confiável. NENHUMA exceção contorna este motivo:
#    aprovação de gestor não torna um dispositivo comprometido seguro.
motivos contains "dispositivo_nao_confiavel" if not dispositivo_confiavel

# --- Condições auxiliares ----------------------------------------------------
# Atenção: se um dado estiver ausente, a condição fica indefinida e o motivo de
# negação é aplicado. Ou seja, dado faltando = negado (falha fechada).

# O usuário tem pelo menos um perfil na lista do sistema (ver data.json).
perfil_autorizado if {
	some perfil in input.usuario.perfis
	perfil in data.sistemas[input.sistema].perfis
}

# A hora atual está entre o início (inclusive) e o fim (exclusive) do sistema.
dentro_do_horario if {
	horario := data.sistemas[input.sistema].horario
	input.hora >= horario.inicio
	input.hora < horario.fim
}

dispositivo_confiavel if input.dispositivo == "confiavel"

# Existe uma exceção para este usuário neste sistema e ela ainda não expirou.
excecao_valida if data.excecoes[input.usuario.id][input.sistema] > input.agora_epoch

# --- Resposta entregue ao gateway --------------------------------------------
decisao := {
	"permitido": permitido,
	"motivos": sort(motivos), # conjunto -> lista ordenada
}
