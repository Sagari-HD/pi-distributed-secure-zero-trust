import { Badge, Brand, Button, TopBar } from './ui.jsx'

const MENU = [
  { id: 'rh', label: 'Início' },
  { id: 'cadastro', label: 'Pessoas' },
  { label: 'Férias' },
  { label: 'Folha de pagamento' },
  { label: 'Relatórios' },
]

// Moldura compartilhada das telas do Portal de RH (barra de cima + menu lateral).
export default function RhLayout({ active, go, children }) {
  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        brand={
          <div className="flex items-center gap-3">
            <Brand mark="RH">Portal de RH</Brand>
            <Badge tone="ok">Sessão verificada</Badge>
          </div>
        }
      >
        <Button variant="secondary" size="sm" onClick={() => go('portal')}>Voltar ao portal</Button>
      </TopBar>
      <div className="flex-1 grid md:grid-cols-[210px_1fr]">
        <nav aria-label="Menu do sistema" className="bg-card border-b md:border-b-0 md:border-r border-line p-4 flex md:flex-col flex-wrap gap-1">
          {MENU.map((m) => (
            <button
              key={m.label}
              onClick={m.id ? () => go(m.id) : undefined}
              className={`text-left min-h-10 px-3 rounded-lg cursor-pointer ${m.id === active ? 'bg-accbg text-acc font-medium' : 'text-ink'}`}
            >
              {m.label}
            </button>
          ))}
        </nav>
        <main className="p-7 min-w-0">{children}</main>
      </div>
    </div>
  )
}
