// =============================================================================
// App.jsx: escolhe a tela. Sem sessão, mostra o Login; com sessão, o portal e as telas
// liberadas. "go(tela, dados)" troca de tela e pode levar dados (ex.: o 403 da Tela 4
// vai para a Tela 8 de solicitação de acesso).
// =============================================================================
import { useCallback, useEffect, useState } from 'react'
import { SessaoProvider, useSessao } from './sessao.jsx'
import DevNav from './DevNav.jsx'
import Login from './screens/Login.jsx'
import Portal from './screens/Portal.jsx'
import Sistema from './screens/Sistema.jsx'
import Negado from './screens/Negado.jsx'
import Auditoria from './screens/Auditoria.jsx'
import RH from './screens/RH.jsx'
import Cadastro from './screens/Cadastro.jsx'
import Solicitar from './screens/Solicitar.jsx'
import Pendentes from './screens/Pendentes.jsx'

const TELAS = [
  { id: 'portal', rotulo: '2 Portal', Tela: Portal },
  { id: 'sistema', rotulo: '3 Financeiro', Tela: Sistema },
  { id: 'negado', rotulo: '4 Acesso negado', Tela: Negado },
  { id: 'auditoria', rotulo: '5 Auditoria', Tela: Auditoria },
  { id: 'rh', rotulo: '6 Portal de RH', Tela: RH },
  { id: 'cadastro', rotulo: '7 Cadastro', Tela: Cadastro },
  { id: 'solicitar', rotulo: '8 Solicitar acesso', Tela: Solicitar },
  { id: 'pendentes', rotulo: '9 Pendentes', Tela: Pendentes },
]

const mostrarBarra = !new URLSearchParams(window.location.search).has('semnav')

function Roteador() {
  const { carregando, usuario } = useSessao()
  const [rota, setRota] = useState({ id: 'portal', dados: null })

  const go = useCallback((id, dados = null) => {
    setRota({ id, dados })
    window.scrollTo(0, 0)
  }, [])

  // Quando a sessão acaba, a próxima entrada começa de novo pelo portal.
  useEffect(() => {
    if (!usuario) setRota({ id: 'portal', dados: null })
  }, [usuario])

  if (carregando) return <p role="status" className="p-6 text-mut">Carregando…</p>
  if (!usuario) return <Login />

  const { Tela } = TELAS.find((t) => t.id === rota.id) ?? TELAS[0]
  return (
    <div className="min-h-screen flex flex-col">
      {mostrarBarra && <DevNav telas={TELAS} atual={rota.id} go={go} />}
      <Tela go={go} dados={rota.dados} />
    </div>
  )
}

export default function App({ autenticador }) {
  return (
    <SessaoProvider autenticador={autenticador}>
      <Roteador />
    </SessaoProvider>
  )
}
