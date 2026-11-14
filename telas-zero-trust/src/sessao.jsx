// =============================================================================
// sessao.jsx: guarda quem está logado e entrega o cliente da API às telas.
// Qualquer tela usa:  const { usuario, api, simulacao, sair } = useSessao()
// =============================================================================
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { criarApi } from './api.js'

const Contexto = createContext(null)
export const useSessao = () => useContext(Contexto)

export function SessaoProvider({ autenticador, children }) {
  // carregando: ainda descobrindo se há sessão | usuario: dados do /me | aviso: recado na tela de login
  const [estado, setEstado] = useState({ carregando: true, usuario: null, aviso: null })

  // Controles da demonstração (barra azul): postura do dispositivo e hora simulada.
  const [simulacao, setSimulacao] = useState({ dispositivo: 'confiavel', hora: '' })
  const simulacaoRef = useRef(simulacao)
  useEffect(() => { simulacaoRef.current = simulacao }, [simulacao])

  const api = useMemo(() => criarApi({
    obterToken: () => autenticador.obterToken(),
    obterSimulacao: () => simulacaoRef.current,
    // 401 em qualquer chamada = sessão vencida ou revogada: volta para o login.
    aoNaoAutenticado: () => {
      autenticador.limpar?.()
      setEstado({ carregando: false, usuario: null, aviso: 'Sua sessão terminou ou foi revogada. Entre novamente.' })
    },
  }), [autenticador])

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const logado = await autenticador.iniciar()
        if (!ativo) return
        if (!logado) return setEstado((e) => ({ ...e, carregando: false }))
        const r = await api.eu() // nome e perfis vêm do gateway, que validou o token
        if (!ativo) return
        setEstado((e) => (r.ok ? { carregando: false, usuario: r.dados, aviso: null } : { ...e, carregando: false }))
      } catch {
        if (ativo) setEstado({ carregando: false, usuario: null, aviso: 'Não foi possível iniciar a sessão.' })
      }
    })()
    return () => { ativo = false }
  }, [autenticador, api])

  const valor = {
    ...estado,
    api,
    simulacao,
    setSimulacao,
    entrar: () => autenticador.entrar(),
    sair: async () => {
      await autenticador.sair()
      await autenticador.limpar?.()
      setEstado({ carregando: false, usuario: null, aviso: null })
    },
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}
