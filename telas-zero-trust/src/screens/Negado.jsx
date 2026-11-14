import { Brand, Button, Card, Dl, Mensagem, Title, TopBar } from '../components/ui.jsx'
import { formatarMomento, rotuloSistema } from '../mapeamentos.js'

// Tela 4. Mostra o corpo do 403 do gateway: motivo, regra aplicada, horário e código da decisão.
// O botão de pedir exceção só aparece quando o motivo admite (permiteExcecao).
export default function Negado({ go, dados }) {
  if (!dados) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar brand={<Brand>Aurora Holdings</Brand>} />
        <main className="flex-1 grid place-items-center p-6">
          <Card className="w-full max-w-[480px] p-8 flex flex-col gap-4">
            <Title sub="Esta tela aparece quando um acesso é bloqueado pela política de segurança.">Nenhum bloqueio recente</Title>
            <div><Button onClick={() => go('portal')}>Voltar ao portal</Button></div>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar brand={<Brand>Aurora Holdings</Brand>} />
      <main className="flex-1 grid place-items-center p-6">
        <Card className="w-full max-w-[480px] p-8 flex flex-col gap-4">
          <span aria-hidden="true" className="grid place-items-center w-12 h-12 rounded-full bg-badbg text-bad text-2xl font-semibold">×</span>
          <Title sub={`A política de segurança bloqueou este acesso ao ${rotuloSistema(dados.sistema)}.`}>Acesso negado</Title>
          <Dl
            items={[
              ['Motivo', dados.motivos.join('; ')],
              ['Regra aplicada', dados.regras.join('; ')],
              ['Horário', formatarMomento(dados.momento)],
              ['Código da decisão', dados.codigoDecisao],
            ]}
          />
          {dados.permiteExcecao ? (
            <p className="text-sm">Você pode pedir uma liberação temporária ao gestor da sua área. O código da decisão vai junto com o pedido.</p>
          ) : (
            <Mensagem>Este motivo não admite liberação temporária. Entre de um dispositivo corporativo ou procure o gestor de TI.</Mensagem>
          )}
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => go('portal')}>Voltar ao portal</Button>
            {dados.permiteExcecao && (
              <Button variant="secondary" onClick={() => go('solicitar', dados)}>Solicitar acesso ao gestor</Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}
