import { Badge, Brand, Button, Card, Mensagem, Title, TopBar } from '../components/ui.jsx'
import { useSessao } from '../sessao.jsx'
import { useProtegido } from '../useProtegido.js'
import { formatarData, formatarMoeda } from '../mapeamentos.js'

const MENU = ['Contas a pagar', 'Contas a receber', 'Fornecedores', 'Relatórios']

// Tela 3. Os lançamentos vêm de GET /api/financeiro/lancamentos, que passa por
// autenticação + política no gateway. Se for negado, o hook leva à Tela 4.
export default function Sistema({ go }) {
  const { api } = useSessao()
  const { carregando, erro, dados } = useProtegido(api.lancamentos, go)

  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        brand={
          <div className="flex items-center gap-3">
            <Brand mark="R$">Sistema Financeiro</Brand>
            <Badge tone="ok">Sessão verificada</Badge>
          </div>
        }
      >
        <Button variant="secondary" size="sm" onClick={() => go('portal')}>Voltar ao portal</Button>
      </TopBar>
      <div className="flex-1 grid md:grid-cols-[210px_1fr]">
        <nav aria-label="Menu do sistema" className="bg-card border-b md:border-b-0 md:border-r border-line p-4 flex md:flex-col flex-wrap gap-1">
          {MENU.map((item, i) => (
            <button key={item} className={`text-left min-h-10 px-3 rounded-lg cursor-pointer ${i === 0 ? 'bg-accbg text-acc font-medium' : 'text-ink'}`}>
              {item}
            </button>
          ))}
        </nav>
        <main className="p-7 min-w-0">
          <div className="flex justify-between items-center gap-4 flex-wrap mb-5">
            <Title sub={dados ? `Consulta liberada pela decisão ${dados.codigoDecisao}.` : 'Lançamentos com vencimento nos próximos 30 dias.'}>
              Contas a pagar
            </Title>
            <Button>Novo lançamento</Button>
          </div>
          {carregando && <Mensagem>Carregando lançamentos…</Mensagem>}
          {erro && <Mensagem tone="bad" role="alert">{erro}</Mensagem>}
          {dados && (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[13px] text-mut">
                    <th className="font-medium px-3.5 py-2.5 border-b border-line">Fornecedor</th>
                    <th className="font-medium px-3.5 py-2.5 border-b border-line">Vencimento</th>
                    <th className="font-medium px-3.5 py-2.5 border-b border-line text-right">Valor</th>
                    <th className="font-medium px-3.5 py-2.5 border-b border-line">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.lancamentos.map((l) => (
                    <tr key={l.fornecedor} className="border-b border-line last:border-0">
                      <td className="px-3.5 py-3">{l.fornecedor}</td>
                      <td className="px-3.5 py-3">{formatarData(l.vencimento)}</td>
                      <td className="px-3.5 py-3 text-right">{formatarMoeda(l.valor)}</td>
                      <td className="px-3.5 py-3"><Badge tone={l.situacao === 'Pago' ? 'ok' : 'info'}>{l.situacao}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
