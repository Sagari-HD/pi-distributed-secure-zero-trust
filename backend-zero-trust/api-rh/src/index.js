// =============================================================================
// Portal de RH (fictício), o outro "sistema protegido" do Diagrama 2.
// Mesma ideia do Financeiro: confia no gateway e só ele consegue chegar aqui.
// O CADASTRO de pessoas (Tela 7) passa pelo gateway em POST /admin/pessoas, que
// cria a conta no Keycloak. Aqui fica só a consulta de exemplo.
// =============================================================================
import express from 'express'

const app = express()

app.get('/pessoas', (req, res) => {
  res.json({
    sistema: 'rh',
    consultadoPor: decodeURIComponent(req.header('x-usuario-nome') ?? 'desconhecido'),
    codigoDecisao: req.header('x-codigo-decisao') ?? null,
    pessoas: [
      { nome: 'Maria Silva', cargo: 'Analista financeira', departamento: 'Financeiro' },
      { nome: 'João Pereira', cargo: 'Assistente de RH', departamento: 'RH' },
      { nome: 'Paulo Mendes', cargo: 'Analista de RH', departamento: 'RH' },
    ],
  })
})

app.listen(Number(process.env.PORT ?? 3000), () => console.log('api-rh no ar'))
