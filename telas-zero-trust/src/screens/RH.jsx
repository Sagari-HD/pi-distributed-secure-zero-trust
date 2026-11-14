import RhLayout from '../components/RhLayout.jsx'
import { Button, Card, Mensagem, Title } from '../components/ui.jsx'
import { useSessao } from '../sessao.jsx'
import { useProtegido } from '../useProtegido.js'

const ATALHOS = [
  { tile: 'PE', nome: 'Cadastro de pessoas', desc: 'Incluir pessoas e liberar o acesso aos sistemas.', destino: 'cadastro' },
  { tile: 'FE', nome: 'Férias', desc: 'Solicitações e calendário da equipe.' },
  { tile: 'FP', nome: 'Folha de pagamento', desc: 'Fechamento mensal e holerites.' },
]

// Tela 6. A lista de pessoas vem de GET /api/rh/pessoas (passa pela política do gateway).
export default function RH({ go }) {
  const { api } = useSessao()
  const { carregando, erro, dados } = useProtegido(api.pessoas, go)

  return (
    <RhLayout active="rh" go={go}>
      <div className="flex justify-between items-center gap-4 flex-wrap mb-5">
        <Title sub="Atalhos e pessoas da empresa.">Portal de RH</Title>
        <Button onClick={() => go('cadastro')}>Cadastrar pessoa</Button>
      </div>
      <div className="grid gap-4 mb-6 md:grid-cols-3">
        {ATALHOS.map((a) => (
          <Card key={a.nome} className="p-5 flex flex-col gap-3">
            <span className="grid place-items-center w-11 h-11 rounded-[10px] bg-accbg text-acc font-semibold">{a.tile}</span>
            <div>
              <h2 className="text-base font-semibold">{a.nome}</h2>
              <p className="text-sm text-mut">{a.desc}</p>
            </div>
            <Button variant="secondary" aria-label={`Abrir ${a.nome}`} onClick={a.destino ? () => go(a.destino) : undefined}>Abrir</Button>
          </Card>
        ))}
      </div>
      <h2 className="text-base font-semibold mb-3">Pessoas</h2>
      {carregando && <Mensagem>Carregando pessoas…</Mensagem>}
      {erro && <Mensagem tone="bad" role="alert">{erro}</Mensagem>}
      {dados && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[13px] text-mut">
                {['Nome', 'Cargo', 'Departamento'].map((c) => (
                  <th key={c} className="font-medium px-3.5 py-2.5 border-b border-line">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.pessoas.map((p) => (
                <tr key={p.nome} className="border-b border-line last:border-0">
                  <td className="px-3.5 py-3">{p.nome}</td>
                  <td className="px-3.5 py-3">{p.cargo}</td>
                  <td className="px-3.5 py-3">{p.departamento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </RhLayout>
  )
}
