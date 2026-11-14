import { useSessao } from '../sessao.jsx'
import { iniciais, rotuloPapel } from '../mapeamentos.js'

export function Card({ className = '', children }) {
  return <div className={`bg-card border border-line rounded-[10px] ${className}`}>{children}</div>
}

const variants = {
  primary: 'bg-acc text-onacc border-acc',
  secondary: 'bg-transparent text-acc border-acc',
  danger: 'bg-transparent text-bad border-bad',
}
const sizes = { md: 'min-h-11 px-[18px]', sm: 'min-h-8 px-3 text-[13px]' }

export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <button
      className={`font-medium rounded-lg border cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}

const tones = { ok: 'bg-okbg text-ok', bad: 'bg-badbg text-bad', info: 'bg-accbg text-acc' }

export function Badge({ tone = 'info', children }) {
  return (
    <span className={`inline-block text-[12.5px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  )
}

// Recado na tela. Use role="alert" para erros e role="status" para avisos informativos.
export function Mensagem({ tone = 'info', role = 'status', children }) {
  return <p role={role} className={`text-sm px-3.5 py-2.5 rounded-lg ${tones[tone]}`}>{children}</p>
}

export function Field({ id, label, hint, ...props }) {
  return (
    <div className="flex flex-col gap-1.5 mb-3.5">
      <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
      <input id={id} className="h-11 px-3 border border-line rounded-lg bg-card text-ink" {...props} />
      {hint && <span className="text-[12.5px] text-mut">{hint}</span>}
    </div>
  )
}

// "options" aceita textos ('Todos') ou objetos { valor, rotulo }.
export function Select({ id, label, options, ...props }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[170px]">
      <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
      <select id={id} className="h-11 px-3 border border-line rounded-lg bg-card text-ink" {...props}>
        {options.map((o) => {
          const { valor, rotulo } = typeof o === 'string' ? { valor: o, rotulo: o } : o
          return <option key={valor} value={valor}>{rotulo}</option>
        })}
      </select>
    </div>
  )
}

export function Brand({ mark = 'A', children }) {
  return (
    <div className="flex items-center gap-2.5 font-semibold">
      <span className="grid place-items-center w-7 h-7 rounded-[7px] bg-acc text-onacc text-sm">{mark}</span>
      {children}
    </div>
  )
}

export function Avatar({ initials }) {
  return (
    <span className="grid place-items-center w-8 h-8 rounded-full bg-accbg text-acc text-xs font-semibold">
      {initials}
    </span>
  )
}

// Barra de cima: o nome e o papel vêm da sessão (resposta do /me). "children" são botões extras.
export function TopBar({ brand, children }) {
  const { usuario, sair } = useSessao()
  return (
    <header className="flex justify-between items-center gap-4 px-6 py-3 bg-card border-b border-line">
      {brand}
      <div className="flex items-center gap-3 text-sm">
        <Avatar initials={iniciais(usuario?.nome)} />
        <span className="leading-tight">
          {usuario?.nome}
          <span className="block text-[12.5px] text-mut">{rotuloPapel(usuario?.perfis)}</span>
        </span>
        {children}
        <Button variant="secondary" size="sm" onClick={sair}>Sair</Button>
      </div>
    </header>
  )
}

export function Dl({ items, className = '' }) {
  return (
    <dl className={`grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-4 gap-y-2.5 text-sm m-0 ${className}`}>
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-mut">{k}</dt>
          <dd className="m-0">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Title({ children, sub }) {
  return (
    <div>
      <h1 className="text-[22px] font-semibold tracking-tight mb-1.5">{children}</h1>
      {sub && <p className="text-mut">{sub}</p>}
    </div>
  )
}
