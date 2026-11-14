// =============================================================================
// Testes de INTEGRAÇÃO: o app React inteiro (jsdom) falando com o gateway REAL,
// que por sua vez usa Keycloak, OPA, APIs e PostgreSQL de verdade.
// Só rodam com o ambiente no ar:   E2E=1 npm test
// O login pelo navegador (redirecionamento ao Keycloak) fica de fora: aqui o token
// vem do Keycloak por senha direta (cliente demo-cli) e entra por um autenticador falso.
// Os testes dependem da ordem (cada um deixa estado no backend para o próximo).
// =============================================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App.jsx'
import { criarApi } from '../api.js'

const KC = process.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080'

async function tokenDe(login) {
  const r = await fetch(`${KC}/realms/aurora/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // Como texto: o jsdom troca a classe URLSearchParams e o fetch do Node recusa a versão dele.
    body: new URLSearchParams({ grant_type: 'password', client_id: 'demo-cli', username: login, password: 'Senha@123' }).toString(),
  })
  return (await r.json()).access_token
}

const autenticadorFalso = (token) => ({
  iniciar: async () => true,
  obterToken: async () => token,
  entrar() {},
  sair: async () => {},
  limpar: async () => {},
})

const abrirComo = (token) => render(<App autenticador={autenticadorFalso(token)} />)
const clicar = (nome) => fireEvent.click(screen.getByRole('button', { name: nome }))
const escolher = (rotulo, valor) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })

describe.skipIf(process.env.E2E !== '1')('integração front + gateway', () => {
  const t = {}
  beforeAll(async () => {
    for (const [chave, login] of Object.entries({
      maria: 'maria.silva', joao: 'joao.pereira', paulo: 'paulo.mendes', fernanda: 'fernanda.lima', carlos: 'carlos.lima',
    })) t[chave] = await tokenDe(login)
  })

  it('Maria abre o Financeiro e vê os lançamentos reais', async () => {
    abrirComo(t.maria)
    await screen.findByText('Olá, Maria')
    escolher('Hora', '10')
    clicar('Abrir Sistema Financeiro')
    expect(await screen.findByText('Papelaria Central')).toBeTruthy()
    expect(screen.getByText(/R\$\s*1\.240,00/)).toBeTruthy()
    expect(screen.getByText(/Consulta liberada pela decisão D-\d+/)).toBeTruthy()
  })

  it('dispositivo não confiável cai na Tela 4 e não oferece exceção', async () => {
    abrirComo(t.maria)
    await screen.findByText('Olá, Maria')
    escolher('Dispositivo', 'nao_confiavel')
    escolher('Hora', '10')
    clicar('Abrir Sistema Financeiro')
    await screen.findByRole('heading', { name: 'Acesso negado' })
    expect(screen.getByText('Dispositivo não reconhecido como confiável')).toBeTruthy()
    expect(screen.getByText(/não admite liberação temporária/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Solicitar acesso ao gestor' })).toBeNull()
  })

  it('João sem perfil: Tela 4 -> Tela 8 e o pedido é enviado', async () => {
    abrirComo(t.joao)
    await screen.findByText('Olá, João')
    escolher('Hora', '10')
    clicar('Abrir Sistema Financeiro')
    await screen.findByRole('heading', { name: 'Acesso negado' })
    expect(screen.getByText('Perfil sem permissão')).toBeTruthy()
    expect(screen.getByText(/^D-\d+$/)).toBeTruthy()
    clicar('Solicitar acesso ao gestor')
    await screen.findByRole('heading', { name: 'Solicitar acesso' })
    fireEvent.change(screen.getByLabelText('Justificativa'), { target: { value: 'Cobertura de férias da equipe' } })
    clicar('Enviar solicitação')
    expect(await screen.findByText(/Pedido enviado/)).toBeTruthy()
  })

  it('Fernanda aprova na Tela 9 e a exceção passa a valer para o João', async () => {
    abrirComo(t.fernanda)
    await screen.findByText('Olá, Fernanda')
    clicar('Abrir Solicitações de acesso')
    await screen.findByRole('heading', { name: 'Solicitações pendentes' })
    const linha = (await screen.findByText('João Pereira')).closest('tr')
    expect(within(linha).getByText('Sistema Financeiro')).toBeTruthy()
    expect(within(linha).getByText('Perfil sem permissão')).toBeTruthy()
    fireEvent.click(within(linha).getByRole('button', { name: 'Aprovar' }))
    expect(await screen.findByText('Pedido de João Pereira aprovado.')).toBeTruthy()

    // Fora do horário (22h) e sem o perfil, mas com a exceção aprovada: o João entra.
    const apiJoao = criarApi({ obterToken: async () => t.joao, obterSimulacao: () => ({ dispositivo: 'confiavel', hora: 22 }) })
    expect((await apiJoao.lancamentos()).status).toBe(200)
  })

  it('Paulo (analista de RH) vê as pessoas e cadastra uma nova', async () => {
    abrirComo(t.paulo)
    await screen.findByText('Olá, Paulo')
    escolher('Hora', '10')
    clicar('Abrir Portal de RH')
    await screen.findByRole('heading', { name: 'Portal de RH' })
    expect(await screen.findByText('Analista de RH', { selector: 'td' })).toBeTruthy()
    clicar('Cadastrar pessoa')
    await screen.findByRole('heading', { name: 'Cadastro de pessoas' })
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Teste Silva' } })
    fireEvent.change(screen.getByLabelText('E-mail corporativo'), { target: { value: `teste.${Date.now()}@aurora.example` } })
    clicar('Salvar cadastro')
    expect(await screen.findByText('Pessoa cadastrada.')).toBeTruthy()
    expect(screen.getByText('Senha temporária')).toBeTruthy()
  })

  it('Carlos revoga a sessão da Maria e o token dela deixa de valer', async () => {
    abrirComo(t.carlos)
    await screen.findByText('Olá, Carlos')
    clicar('Abrir Painel de auditoria')
    await screen.findByRole('heading', { name: 'Decisões de acesso' })
    const linha = (await screen.findAllByText('Maria Silva'))[0].closest('tr')
    fireEvent.click(within(linha).getByRole('button', { name: 'Revogar sessão' }))
    expect(await screen.findByText(/Sessões de Maria Silva revogadas/)).toBeTruthy()
    const r = await criarApi({ obterToken: async () => t.maria }).eu()
    expect(r.status).toBe(401)
  })

  it('com a sessão revogada, o app volta ao login com aviso', async () => {
    abrirComo(t.maria)
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/sessão terminou ou foi revogada/)
    expect(screen.getByRole('button', { name: 'Entrar com a conta corporativa' })).toBeTruthy()
  })
})
