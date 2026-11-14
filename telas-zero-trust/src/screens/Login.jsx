import { Brand, Button, Card, Mensagem, Title } from '../components/ui.jsx'
import { useSessao } from '../sessao.jsx'

// Tela 1. A senha e o código MFA são digitados na página do Keycloak (é a identidade
// da empresa), não aqui: o aplicativo nunca toca na senha.
export default function Login() {
  const { entrar, aviso } = useSessao()
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-[400px] p-8 flex flex-col gap-4">
        <Brand>Aurora Holdings</Brand>
        <Title sub="O acesso vale para todos os sistemas liberados ao seu perfil.">Entrar na conta corporativa</Title>
        {aviso && <Mensagem tone="bad" role="alert">{aviso}</Mensagem>}
        <Button onClick={entrar}>Entrar com a conta corporativa</Button>
        <p className="text-[12.5px] text-mut">
          Você será levado à página de login segura da empresa, com verificação em duas etapas (MFA).
        </p>
        <p className="text-center text-[12.5px] text-mut">Seu acesso é verificado a cada solicitação.</p>
      </Card>
    </main>
  )
}
