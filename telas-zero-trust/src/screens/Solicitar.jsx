import { useState } from 'react'
import { Brand, Button, Card, Dl, Mensagem, Select, Title, TopBar } from '../components/ui.jsx'
import { useSessao } from '../sessao.jsx'
import { PERIODOS, rotuloSistema } from '../mapeamentos.js'

// Tela 8. O pedido nasce de uma negação (Tela 4): leva o código da decisão. O gateway confere
// que a decisão é desta pessoa, foi uma negação e admite exceção.
export default function Solicitar({ go, dados }) {
  const { api } = useSessao()
  const [justificativa, setJustificativa] = useState('')
  const [periodo, setPeriodo] = useState('4 horas')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [enviado, setEnviado] = useState(false)

  if (!dados?.codigoDecisao) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar brand={<Brand>Aurora Holdings</Brand>} />
        <main className="flex-1 grid place-items-center p-6">
          <Card className="w-full max-w-[520px] p-8 flex flex-col gap-4">
            <Title sub="O pedido de acesso parte de uma tela de acesso negado. Tente abrir o sistema primeiro.">Nada para solicitar</Title>
            <div><Button onClick={() => go('portal')}>Voltar ao portal</Button></div>
          </Card>
        </main>
      </div>
    )
  }

  async function enviar() {
    setErro(null)
    if (justificativa.trim().length < 5) return setErro('Explique em poucas palavras por que você precisa do acesso.')
    setEnviando(true)
    const r = await api.criarSolicitacao({
      codigoDecisao: dados.codigoDecisao,
      justificativa: justificativa.trim(),
      periodoHoras: PERIODOS.find((p) => p.rotulo === periodo).horas,
    })
    setEnviando(false)
    if (r.status === 201) return setEnviado(true)
    if (r.status === 409) return setErro('Você já tem um pedido pendente para este sistema.')
    if (r.status === 422) return setErro('Este motivo não admite liberação temporária.')
    if (r.status === 400) return setErro('Não foi possível validar o pedido. Tente abrir o sistema de novo para gerar uma nova decisão.')
    setErro('Não foi possível enviar agora. Tente de novo.')
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar brand={<Brand>Aurora Holdings</Brand>} />
      <main className="flex-1 grid place-items-center p-6">
        <Card className="w-full max-w-[520px] p-8 flex flex-col gap-4">
          <Title sub="O pedido vai para os gestores da área e leva o código da decisão que bloqueou o acesso.">Solicitar acesso</Title>
          <Dl
            items={[
              ['Sistema', rotuloSistema(dados.sistema)],
              ['Motivo do bloqueio', dados.motivos.join('; ')],
              ['Código da decisão', dados.codigoDecisao],
            ]}
          />
          {enviado ? (
            <>
              <Mensagem tone="ok">Pedido enviado. Você será liberado se um gestor aprovar, pelo período escolhido.</Mensagem>
              <div><Button onClick={() => go('portal')}>Voltar ao portal</Button></div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="justificativa" className="text-[13px] font-medium">Justificativa</label>
                <textarea id="justificativa" value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Explique por que você precisa do acesso agora"
                  className="min-h-24 px-3 py-2.5 border border-line rounded-lg bg-card text-ink resize-y" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Select id="periodo" label="Período necessário" value={periodo} onChange={(e) => setPeriodo(e.target.value)}
                  options={PERIODOS.map((p) => p.rotulo)} />
                <span className="text-[12.5px] text-mut">Se aprovado, o acesso expira sozinho no fim do período.</span>
              </div>
              {erro && <Mensagem tone="bad" role="alert">{erro}</Mensagem>}
              <div className="flex gap-3 flex-wrap">
                <Button onClick={enviar} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar solicitação'}</Button>
                <Button variant="secondary" onClick={() => go('negado', dados)}>Cancelar</Button>
              </div>
            </>
          )}
        </Card>
      </main>
    </div>
  )
}
