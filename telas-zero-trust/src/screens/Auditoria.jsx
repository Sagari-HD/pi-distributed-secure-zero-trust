import { useCallback, useEffect, useState } from 'react'
import { Badge, Brand, Button, Card, Field, Mensagem, Select, Title, TopBar } from '../components/ui.jsx'
import { useSessao } from '../sessao.jsx'
import { formatarHora, rotuloSistema } from '../mapeamentos.js'

// Tela 5 (gestor de TI). Lista GET /admin/auditoria e permite revogar a sessão de um usuário.
export default function Auditoria({ go }) {
  const { api } = useSessao()
  const [filtros, setFiltros] = useState({ usuario: '', sistema: '', decisao: '' })
  const [estado, setEstado] = useState({ carregando: true })
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(async () => {
    const r = await api.auditoria(filtros)
    if (r.ok) return setEstado({ linhas: r.dados })
    setEstado({
      erro: r.status === 403 ? 'Você não tem permissão para ver a auditoria.' : 'Não foi possível carregar a auditoria.',
    })
  }, [api, filtros])

  useEffect(() => { carregar() }, [carregar])

  async function revogar(linha) {
    setAviso(null)
    const r = await api.revogarSessao(linha.usuarioId)
    setAviso(
      r.ok
        ? { tone: 'ok', texto: `Sessões de ${linha.usuario} revogadas. O token dela deixa de valer na próxima requisição.` }
        : { tone: 'bad', texto: 'Não foi possível revogar a sessão.' },
    )
  }

  const mudar = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value })

  return (
    <div className="flex-1 flex flex-col">
      <TopBar brand={<Brand>Painel de auditoria</Brand>}>
        <Button variant="secondary" size="sm" onClick={() => go('portal')}>Voltar ao portal</Button>
      </TopBar>
      <main className="w-full max-w-[1000px] mx-auto px-6 py-8">
        <Title sub="Cada requisição aos sistemas gera um registro, permitida ou negada.">Decisões de acesso</Title>
        <div className="flex gap-3 flex-wrap items-end my-5">
          <div className="min-w-[170px] [&>div]:mb-0">
            <Field id="f-usuario" label="Usuário" placeholder="Nome da pessoa" value={filtros.usuario} onChange={mudar('usuario')} />
          </div>
          <Select id="f-sistema" label="Sistema" value={filtros.sistema} onChange={mudar('sistema')}
            options={[{ valor: '', rotulo: 'Todos' }, { valor: 'rh', rotulo: 'Portal de RH' }, { valor: 'financeiro', rotulo: 'Sistema Financeiro' }]} />
          <Select id="f-decisao" label="Decisão" value={filtros.decisao} onChange={mudar('decisao')}
            options={[{ valor: '', rotulo: 'Todas' }, 'Permitido', 'Negado']} />
          <Button variant="secondary" onClick={carregar}>Atualizar</Button>
        </div>
        {aviso && <div className="mb-4"><Mensagem tone={aviso.tone} role={aviso.tone === 'bad' ? 'alert' : 'status'}>{aviso.texto}</Mensagem></div>}
        {estado.carregando && <Mensagem>Carregando…</Mensagem>}
        {estado.erro && <Mensagem tone="bad" role="alert">{estado.erro}</Mensagem>}
        {estado.linhas && (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[13px] text-mut">
                  {['Hora', 'Código', 'Usuário', 'Sistema', 'Decisão', 'Regra aplicada', 'Sessão'].map((c) => (
                    <th key={c} className="font-medium px-3.5 py-2.5 border-b border-line whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estado.linhas.length === 0 && (
                  <tr><td colSpan={7} className="px-3.5 py-4 text-mut">Nenhuma decisão encontrada.</td></tr>
                )}
                {estado.linhas.map((l) => (
                  <tr key={l.codigoDecisao} className="border-b border-line last:border-0">
                    <td className="px-3.5 py-3">{formatarHora(l.momento)}</td>
                    <td className="px-3.5 py-3">{l.codigoDecisao}</td>
                    <td className="px-3.5 py-3">{l.usuario ?? '—'}</td>
                    <td className="px-3.5 py-3">{rotuloSistema(l.sistema)}</td>
                    <td className="px-3.5 py-3"><Badge tone={l.decisao === 'Negado' ? 'bad' : 'ok'}>{l.decisao}</Badge></td>
                    <td className="px-3.5 py-3">{l.regras.length ? l.regras.join('; ') : 'Todas as regras atendidas'}</td>
                    <td className="px-3.5 py-3">
                      {l.usuarioId && <Button variant="danger" size="sm" onClick={() => revogar(l)}>Revogar sessão</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </div>
  )
}
