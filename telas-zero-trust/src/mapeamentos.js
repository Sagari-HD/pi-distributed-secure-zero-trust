// =============================================================================
// mapeamentos.js: funções puras que traduzem entre o que o backend envia/espera
// e o que as telas mostram (rótulos, formatos, perfis). Fáceis de testar.
// =============================================================================

// Nomes dos sistemas: o backend usa "financeiro" e "rh".
export const ROTULO_SISTEMA = { financeiro: 'Sistema Financeiro', rh: 'Portal de RH' }
export const rotuloSistema = (id) => ROTULO_SISTEMA[id] ?? id

// Quais perfis dão acesso a cada sistema. É só para o selo "Acesso liberado" do portal;
// QUEM DECIDE de verdade é o gateway com o OPA (opa/policies/data.json).
const PERFIS_DO_SISTEMA = { financeiro: ['acesso_financeiro'], rh: ['acesso_rh', 'analista_rh'] }
export const temPerfilParaSistema = (perfis, sistema) =>
  (PERFIS_DO_SISTEMA[sistema] ?? []).some((p) => perfis.includes(p))

// Texto do cargo mostrado ao lado do nome.
export function rotuloPapel(perfis = []) {
  if (perfis.includes('gestor_ti')) return 'Gestor de TI'
  if (perfis.includes('gestor_area')) return 'Gestor de área'
  if (perfis.includes('analista_rh')) return 'Analista de RH'
  return 'Colaborador'
}

export const iniciais = (nome = '') =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')

export const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

// "2026-10-28" -> "28/10/2026" (sem criar Date, para não deslocar o dia por fuso).
export function formatarData(iso) {
  const [ano, mes, dia] = String(iso).split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : String(iso)
}

export const formatarHora = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// "Hoje, 22:12" ou "09/11/2026, 22:12".
export function formatarMomento(iso) {
  const d = new Date(iso)
  const ehHoje = d.toDateString() === new Date().toDateString()
  return `${ehHoje ? 'Hoje' : d.toLocaleDateString('pt-BR')}, ${formatarHora(iso)}`
}

// Períodos do acesso temporário (Tela 8): o backend recebe o número de horas.
export const PERIODOS = [
  { rotulo: '1 hora', horas: 1 },
  { rotulo: '4 horas', horas: 4 },
  { rotulo: '1 dia', horas: 24 },
  { rotulo: '3 dias', horas: 72 },
]
export const rotuloPeriodo = (horas) => PERIODOS.find((p) => p.horas === horas)?.rotulo ?? `${horas} horas`

// Cadastro de pessoas (Tela 7): o formulário tem "Nome completo", o backend quer nome + sobrenome.
export function separarNome(completo = '') {
  const partes = completo.trim().split(/\s+/).filter(Boolean)
  if (partes.length < 2) return null
  return { nome: partes[0], sobrenome: partes.slice(1).join(' ') }
}

// Converte o que a Tela 7 marca (sistemas + perfil de gestor) nos perfis do Keycloak.
export function perfisDoCadastro({ sistemas, gestorDeArea }) {
  const perfis = []
  if (sistemas.financeiro) perfis.push('acesso_financeiro')
  if (sistemas.rh) perfis.push('acesso_rh')
  if (gestorDeArea) perfis.push('gestor_area')
  return perfis
}

export const emailValido = (email = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
