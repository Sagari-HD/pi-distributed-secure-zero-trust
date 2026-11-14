# Testes da política. Rodam com:  opa test opa/policies opa/testes -v
package zerotrust.acesso_test

import data.zerotrust.acesso
import rego.v1

# Dados de exemplo usados só nos testes (iguais ao data.json).
sistemas := {
	"financeiro": {"perfis": ["acesso_financeiro"], "horario": {"inicio": 7, "fim": 20}},
	"rh": {"perfis": ["acesso_rh", "analista_rh"], "horario": {"inicio": 7, "fim": 20}},
}

maria := {"id": "u1", "perfis": ["acesso_financeiro", "acesso_rh"]}

joao := {"id": "u2", "perfis": ["acesso_rh"]}

pedido(usuario, sistema, hora, dispositivo) := {
	"usuario": usuario,
	"sistema": sistema,
	"hora": hora,
	"dispositivo": dispositivo,
	"agora_epoch": 1000,
}

test_permite_quando_tudo_esta_ok if {
	acesso.permitido with input as pedido(maria, "financeiro", 10, "confiavel") with data.sistemas as sistemas
}

test_nega_fora_do_horario if {
	r := acesso.decisao with input as pedido(maria, "financeiro", 22, "confiavel") with data.sistemas as sistemas
	r == {"permitido": false, "motivos": ["fora_do_horario"]}
}

test_nega_perfil_sem_permissao if {
	r := acesso.decisao with input as pedido(joao, "financeiro", 10, "confiavel") with data.sistemas as sistemas
	r == {"permitido": false, "motivos": ["perfil_sem_permissao"]}
}

test_nega_dispositivo_nao_confiavel if {
	r := acesso.decisao with input as pedido(maria, "financeiro", 10, "nao_confiavel") with data.sistemas as sistemas
	r == {"permitido": false, "motivos": ["dispositivo_nao_confiavel"]}
}

test_acumula_varios_motivos if {
	r := acesso.decisao with input as pedido(joao, "financeiro", 22, "nao_confiavel") with data.sistemas as sistemas
	r.motivos == ["dispositivo_nao_confiavel", "fora_do_horario", "perfil_sem_permissao"]
}

# Falha fechada: se o dispositivo nem for informado, nega.
test_nega_sem_informacao_de_dispositivo if {
	entrada := object.remove(pedido(maria, "financeiro", 10, "confiavel"), ["dispositivo"])
	not acesso.permitido with input as entrada with data.sistemas as sistemas
}

# Sistema desconhecido: nega.
test_nega_sistema_desconhecido if {
	not acesso.permitido with input as pedido(maria, "inexistente", 10, "confiavel") with data.sistemas as sistemas
}

# Exceção temporária válida libera perfil e horário...
test_excecao_valida_libera_perfil_e_horario if {
	acesso.permitido with input as pedido(joao, "financeiro", 22, "confiavel")
		with data.sistemas as sistemas
		with data.excecoes as {"u2": {"financeiro": 2000}}
}

# ...mas nunca libera dispositivo não confiável.
test_excecao_nao_libera_dispositivo if {
	r := acesso.decisao with input as pedido(joao, "financeiro", 22, "nao_confiavel")
		with data.sistemas as sistemas
		with data.excecoes as {"u2": {"financeiro": 2000}}
	r == {"permitido": false, "motivos": ["dispositivo_nao_confiavel"]}
}

# Exceção expirada (expirou em 500, agora é 1000) não vale.
test_excecao_expirada_nao_vale if {
	not acesso.permitido with input as pedido(joao, "financeiro", 10, "confiavel")
		with data.sistemas as sistemas
		with data.excecoes as {"u2": {"financeiro": 500}}
}
