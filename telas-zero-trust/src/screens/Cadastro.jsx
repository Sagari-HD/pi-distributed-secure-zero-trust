import { useState } from 'react'
import RhLayout from '../components/RhLayout.jsx'
import { Button, Card, Dl, Field, Mensagem, Select, Title } from '../components/ui.jsx'
import { useSessao } from '../sessao.jsx'
import { emailValido, perfisDoCadastro, separarNome } from '../mapeamentos.js'

// Tela 7 (analista de RH). Envia POST /admin/pessoas: o gateway cria a conta no Keycloak,
// que guarda só o hash da senha (com salt). A senha temporária aparece UMA vez, no resultado.
export default function Cadastro({ go }) {
  const { api } = useSessao()
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [perfil, setPerfil] = useState('colaborador')
  const [sistemas, setSistemas] = useState({ financeiro: false, rh: true })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [resultado, setResultado] = useState(null)

  async function salvar() {
    setErro(null)
    const nome = separarNome(nomeCompleto)
    const perfis = perfisDoCadastro({ sistemas, gestorDeArea: perfil === 'gestor_area' })
    if (!nome) return setErro('Informe nome e sobrenome.')
    if (!emailValido(email)) return setErro('Informe um e-mail corporativo válido.')
    if (perfis.length === 0) return setErro('Marque pelo menos um sistema.')

    setEnviando(true)
    const r = await api.cadastrarPessoa({ ...nome, email, perfis })
    setEnviando(false)

    if (r.status === 201) return setResultado({ email, senhaTemporaria: r.dados.senhaTemporaria })
    if (r.status === 409) return setErro('Já existe uma pessoa com este e-mail.')
    if (r.status === 403) return setErro('Somente o analista de RH pode cadastrar pessoas.')
    if (r.status === 400) return setErro('Os dados não foram aceitos. Confira os campos.')
    setErro('Não foi possível cadastrar agora. Tente de novo.')
  }

  function novoCadastro() {
    setResultado(null); setNomeCompleto(''); setEmail(''); setPerfil('colaborador'); setSistemas({ financeiro: false, rh: true })
  }

  if (resultado) {
    return (
      <RhLayout active="cadastro" go={go}>
        <div className="max-w-[820px] flex flex-col gap-4">
          <Title>Cadastro de pessoas</Title>
          <Mensagem tone="ok">Pessoa cadastrada.</Mensagem>
          <Card className="p-5 flex flex-col gap-4">
            <Dl items={[['Login (e-mail)', resultado.email], ['Senha temporária', <code key="s" className="select-all">{resultado.senhaTemporaria}</code>]]} />
            <p className="text-sm text-mut">
              Esta senha aparece só agora. Entregue por um canal seguro. No primeiro login a pessoa será obrigada a trocá-la e a configurar o autenticador (MFA).
            </p>
          </Card>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={novoCadastro}>Cadastrar outra pessoa</Button>
            <Button variant="secondary" onClick={() => go('rh')}>Voltar ao Portal de RH</Button>
          </div>
        </div>
      </RhLayout>
    )
  }

  return (
    <RhLayout active="cadastro" go={go}>
      <div className="max-w-[820px]">
        <div className="mb-5"><Title sub="Dados da pessoa e acesso aos sistemas.">Cadastro de pessoas</Title></div>

        <Card className="p-5 mb-4">
          <h2 className="text-base font-semibold mb-3.5">Dados da pessoa</h2>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field id="nome" label="Nome completo" placeholder="Nome e sobrenome" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
            <Field id="mail" label="E-mail corporativo" placeholder="nome.sobrenome@aurora.example" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </Card>

        <Card className="p-5 mb-4">
          <h2 className="text-base font-semibold mb-1">Acesso aos sistemas</h2>
          <p className="text-[12.5px] text-mut mb-3.5">A conta é criada no provedor de identidade e vale para o login único.</p>
          <div className="mb-3.5">
            <Select id="perfil" label="Perfil de acesso" value={perfil} onChange={(e) => setPerfil(e.target.value)}
              options={[{ valor: 'colaborador', rotulo: 'Colaborador' }, { valor: 'gestor_area', rotulo: 'Gestor de área' }]} />
          </div>
          <fieldset>
            <legend className="text-[13px] font-medium mb-1">Sistemas liberados</legend>
            {[['rh', 'Portal de RH'], ['financeiro', 'Sistema Financeiro']].map(([chave, rotulo]) => (
              <label key={chave} htmlFor={`sis-${chave}`} className="flex items-center gap-2.5 min-h-10 text-sm">
                <input id={`sis-${chave}`} type="checkbox" checked={sistemas[chave]}
                  onChange={(e) => setSistemas({ ...sistemas, [chave]: e.target.checked })}
                  className="w-[18px] h-[18px] accent-[var(--acc)]" />
                {rotulo}
              </label>
            ))}
          </fieldset>
        </Card>

        {erro && <div className="mb-4"><Mensagem tone="bad" role="alert">{erro}</Mensagem></div>}
        <div className="flex gap-3 justify-end flex-wrap">
          <Button variant="secondary" onClick={() => go('rh')}>Cancelar</Button>
          <Button onClick={salvar} disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar cadastro'}</Button>
        </div>
      </div>
    </RhLayout>
  )
}
