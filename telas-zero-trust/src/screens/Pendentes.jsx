import { useCallback, useEffect, useState } from 'react'
import { Brand, Button, Card, Mensagem, Title, TopBar } from '../components/ui.jsx'
import { useSessao } from '../sessao.jsx'
import { rotuloPeriodo, rotuloSistema } from '../mapeamentos.js'

// Tela 9 (gestor de área). Lista GET /solicitacoes e decide com PATCH /solicitacoes/:id.
// Aprovar cria uma exceção temporária na política (nunca vale para dispositivo não confiável).
export default function Pendentes({ go }) {
  const { api, usuario } = useSessao()
  const [estado, setEstado] = useState({ carregando: true })
  const [aviso, setAviso] = useState(null)
  const podeDecidir = usuario.perfis.includes('gestor_area')

  const carregar = useCallback(async () => {
    const r = await api.pendentes()
    if (r.ok) return setEstado({ pedidos: r.dados })
    setEstado({ erro: r.status === 403 ? 'Você não tem permissão para ver as solicitações.' : 'Não foi possível carregar as solicitações.' })
  }, [api])

  useEffect(() => { carregar() }, [carregar])

  async function decidir(pedido, decisao) {
    setAviso(null)
    const r = await api.decidirSolicitacao(pedido.id, decisao)
    if (r.ok) {
      setAviso({ tone: 'ok', texto: `Pedido de ${pedido.usuario} ${decisao === 'aprovada' ? 'aprovado' : 'negado'}.` })
      return carregar()
    }
    if (r.dados?.erro === 'nao_pode_decidir_o_proprio_pedido') {
      return setAviso({ tone: 'bad', texto: 'Você não pode decidir o próprio pedido. Outro gestor precisa fazer isso.' })
    }
    setAviso({ tone: 'bad', texto: 'Não foi possível registrar a decisão.' })
    carregar()
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar brand={<Brand>Solicitações de acesso</Brand>}>
        <Button variant="secondary" size="sm" onClick={() => go('portal')}>Voltar ao portal</Button>
      </TopBar>
      <main className="w-full max-w-[1000px] mx-auto px-6 py-8">
        <Title sub="Aprove ou negue os pedidos da sua área. Toda aprovação é temporária e fica registrada na auditoria.">Solicitações pendentes</Title>
        {aviso && <div className="mt-4"><Mensagem tone={aviso.tone} role={aviso.tone === 'bad' ? 'alert' : 'status'}>{aviso.texto}</Mensagem></div>}
        <div className="mt-5">
          {estado.carregando && <Mensagem>Carregando…</Mensagem>}
          {estado.erro && <Mensagem tone="bad" role="alert">{estado.erro}</Mensagem>}
          {estado.pedidos && (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[13px] text-mut">
                    {['Solicitante', 'Sistema', 'Motivo do bloqueio', 'Justificativa', 'Período', 'Decisão'].map((c) => (
                      <th key={c} className="font-medium px-3.5 py-2.5 border-b border-line whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estado.pedidos.length === 0 && (
                    <tr><td colSpan={6} className="px-3.5 py-4 text-mut">Nenhum pedido pendente.</td></tr>
                  )}
                  {estado.pedidos.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-3.5 py-3">{p.usuario}</td>
                      <td className="px-3.5 py-3">{rotuloSistema(p.sistema)}</td>
                      <td className="px-3.5 py-3">{p.motivosTexto.join('; ')}</td>
                      <td className="px-3.5 py-3">{p.justificativa}</td>
                      <td className="px-3.5 py-3 whitespace-nowrap">{rotuloPeriodo(p.periodoHoras)}</td>
                      <td className="px-3.5 py-3">
                        {podeDecidir ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => decidir(p, 'aprovada')}>Aprovar</Button>
                            <Button size="sm" variant="secondary" onClick={() => decidir(p, 'negada')}>Negar</Button>
                          </div>
                        ) : (
                          <span className="text-mut">Só gestor de área decide</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          <p className="mt-3 text-[12.5px] text-mut">Para aprovar, o desenho do projeto prevê confirmação com MFA; o protótipo ainda não faz essa etapa extra.</p>
        </div>
      </main>
    </div>
  )
}
