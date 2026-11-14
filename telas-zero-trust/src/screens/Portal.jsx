import { Badge, Brand, Button, Card, Dl, Title, TopBar } from '../components/ui.jsx'
import { useSessao } from '../sessao.jsx'
import { rotuloPapel, temPerfilParaSistema } from '../mapeamentos.js'

const SISTEMAS = [
  { chave: 'rh', tile: 'RH', nome: 'Portal de RH', desc: 'Folha, férias e cadastro de pessoas.', destino: 'rh' },
  { chave: 'financeiro', tile: 'R$', nome: 'Sistema Financeiro', desc: 'Contas a pagar, contas a receber e relatórios.', destino: 'sistema' },
]

// Tela 2. O nome e os perfis vêm do gateway (/me). O selo "Acesso liberado" só olha os perfis;
// o botão fica sempre ativo de propósito: quem decide é o gateway, e um 403 leva à Tela 4.
export default function Portal({ go }) {
  const { usuario, simulacao } = useSessao()
  const perfis = usuario.perfis
  const primeiroNome = usuario.nome.split(' ')[0]

  // Atalhos que só aparecem para quem tem o perfil (no fluxograma: "Perfil gestor").
  const extras = []
  if (perfis.includes('gestor_area')) {
    extras.push({ tile: 'SA', nome: 'Solicitações de acesso', desc: 'Aprove ou negue pedidos de acesso temporário.', destino: 'pendentes' })
  }
  if (perfis.includes('gestor_ti')) {
    extras.push({ tile: 'AU', nome: 'Painel de auditoria', desc: 'Decisões de acesso e revogação de sessões.', destino: 'auditoria' })
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar brand={<Brand>Aurora Holdings</Brand>} />
      <main className="w-full max-w-[1000px] mx-auto px-6 py-8">
        <Title sub="Você entrou uma vez e já pode abrir os sistemas liberados para o seu perfil.">{`Olá, ${primeiroNome}`}</Title>
        <div className="grid gap-4 mt-6 items-start lg:grid-cols-[1fr_300px]">
          <div className="grid gap-4 sm:grid-cols-2 content-start">
            {SISTEMAS.map((s) => {
              const liberado = temPerfilParaSistema(perfis, s.chave)
              return (
                <Card key={s.nome} className="p-5 flex flex-col gap-3">
                  <span className="grid place-items-center w-11 h-11 rounded-[10px] bg-accbg text-acc font-semibold">{s.tile}</span>
                  <div>
                    <h2 className="text-base font-semibold">{s.nome}</h2>
                    <p className="text-sm text-mut">{s.desc}</p>
                  </div>
                  <span><Badge tone={liberado ? 'ok' : 'bad'}>{liberado ? 'Acesso liberado' : 'Sem perfil de acesso'}</Badge></span>
                  <Button variant={liberado ? 'primary' : 'secondary'} aria-label={`Abrir ${s.nome}`} onClick={() => go(s.destino)}>
                    Abrir sistema
                  </Button>
                </Card>
              )
            })}
            {extras.map((e) => (
              <Card key={e.nome} className="p-5 flex flex-col gap-3">
                <span className="grid place-items-center w-11 h-11 rounded-[10px] bg-accbg text-acc font-semibold">{e.tile}</span>
                <div>
                  <h2 className="text-base font-semibold">{e.nome}</h2>
                  <p className="text-sm text-mut">{e.desc}</p>
                </div>
                <Button variant="secondary" aria-label={`Abrir ${e.nome}`} onClick={() => go(e.destino)}>Abrir</Button>
              </Card>
            ))}
          </div>
          <Card className="p-5">
            <h2 className="text-base font-semibold">Sua sessão</h2>
            <Dl
              className="mt-3.5 !grid-cols-1 !gap-y-0.5"
              items={[
                ['Login único', <Badge key="a" tone="ok">Ativo</Badge>],
                ['Perfil', rotuloPapel(perfis)],
                ['Dispositivo (simulado)', <Badge key="b" tone={simulacao.dispositivo === 'confiavel' ? 'ok' : 'bad'}>{simulacao.dispositivo === 'confiavel' ? 'Confiável' : 'Não confiável'}</Badge>],
                ['Horário', simulacao.hora ? `Simulado: ${simulacao.hora}h` : 'Hora real'],
              ]}
            />
          </Card>
        </div>
      </main>
    </div>
  )
}
