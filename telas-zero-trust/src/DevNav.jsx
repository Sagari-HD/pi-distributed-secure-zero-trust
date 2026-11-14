import { useSessao } from './sessao.jsx'
import { Select } from './components/ui.jsx'

// Barra azul de DEMONSTRAÇÃO: atalhos entre telas e os dois controles que simulam
// a postura do dispositivo e o horário (no protótipo, o gateway lê esses cabeçalhos).
// Abra a página com ?semnav para escondê-la.
export default function DevNav({ telas, atual, go }) {
  const { simulacao, setSimulacao } = useSessao()
  return (
    <div className="flex items-end gap-x-4 gap-y-2 flex-wrap px-6 py-2.5 bg-accbg border-b border-line text-[13px] text-mut">
      <div className="flex items-center gap-2 flex-wrap pb-0.5">
        <span>Telas:</span>
        {telas.map((t) => (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            aria-current={t.id === atual ? 'page' : undefined}
            className={`min-h-8 px-3 rounded-full border cursor-pointer text-[13px] ${
              t.id === atual ? 'bg-acc text-onacc border-acc' : 'bg-card text-ink border-line'
            }`}
          >
            {t.rotulo}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-3 flex-wrap ml-auto">
        <div className="[&_select]:h-8 [&_select]:text-[13px] [&>div]:min-w-0">
          <Select
            id="dev-dispositivo"
            label="Dispositivo"
            value={simulacao.dispositivo}
            onChange={(e) => setSimulacao({ ...simulacao, dispositivo: e.target.value })}
            options={[
              { valor: 'confiavel', rotulo: 'Confiável' },
              { valor: 'nao_confiavel', rotulo: 'Não confiável' },
            ]}
          />
        </div>
        <div className="[&_select]:h-8 [&_select]:text-[13px] [&>div]:min-w-0">
          <Select
            id="dev-hora"
            label="Hora"
            value={simulacao.hora}
            onChange={(e) => setSimulacao({ ...simulacao, hora: e.target.value })}
            options={[
              { valor: '', rotulo: 'Hora real' },
              { valor: '10', rotulo: 'Simular 10h (dentro do horário)' },
              { valor: '22', rotulo: 'Simular 22h (fora do horário)' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
