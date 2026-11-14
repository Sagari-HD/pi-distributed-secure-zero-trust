import { describe, expect, it } from 'vitest'
import {
  emailValido, formatarData, formatarMoeda, iniciais, perfisDoCadastro,
  rotuloPapel, rotuloPeriodo, rotuloSistema, separarNome, temPerfilParaSistema,
} from '../mapeamentos.js'

describe('mapeamentos', () => {
  it('formata moeda e data como as telas mostram', () => {
    expect(formatarMoeda(1240)).toMatch(/R\$\s*1\.240,00/)
    expect(formatarData('2026-10-28')).toBe('28/10/2026')
  })

  it('traduz sistemas, papéis e iniciais', () => {
    expect(rotuloSistema('financeiro')).toBe('Sistema Financeiro')
    expect(rotuloSistema('rh')).toBe('Portal de RH')
    expect(rotuloPapel(['acesso_rh', 'gestor_ti'])).toBe('Gestor de TI')
    expect(rotuloPapel(['gestor_area'])).toBe('Gestor de área')
    expect(rotuloPapel(['acesso_rh'])).toBe('Colaborador')
    expect(iniciais('Maria da Silva')).toBe('MD')
  })

  it('sabe quais perfis dão acesso a cada sistema', () => {
    expect(temPerfilParaSistema(['acesso_financeiro'], 'financeiro')).toBe(true)
    expect(temPerfilParaSistema(['acesso_rh'], 'financeiro')).toBe(false)
    expect(temPerfilParaSistema(['analista_rh'], 'rh')).toBe(true)
  })

  it('separa nome e sobrenome do cadastro', () => {
    expect(separarNome('Ana Maria da Costa')).toEqual({ nome: 'Ana', sobrenome: 'Maria da Costa' })
    expect(separarNome('Ana')).toBeNull()
    expect(separarNome('   ')).toBeNull()
  })

  it('converte o que a Tela 7 marca em perfis do Keycloak', () => {
    expect(perfisDoCadastro({ sistemas: { financeiro: true, rh: true }, gestorDeArea: true }))
      .toEqual(['acesso_financeiro', 'acesso_rh', 'gestor_area'])
    expect(perfisDoCadastro({ sistemas: { financeiro: false, rh: false }, gestorDeArea: false })).toEqual([])
  })

  it('valida e-mail e rotula períodos', () => {
    expect(emailValido('ana@aurora.example')).toBe(true)
    expect(emailValido('ana@')).toBe(false)
    expect(rotuloPeriodo(24)).toBe('1 dia')
    expect(rotuloPeriodo(5)).toBe('5 horas')
  })
})
