// =============================================================================
// Sistema Financeiro (fictício), um dos "sistemas protegidos" do Diagrama 2.
//
// Este serviço NÃO confere token nem política: ele confia no gateway, e no Docker
// só o gateway consegue alcançá-lo (não há "ports" no docker-compose.yml).
// O gateway repassa o usuário nos cabeçalhos x-usuario-* depois de liberar o acesso.
// =============================================================================
import express from 'express'

const app = express()

app.get('/lancamentos', (req, res) => {
  res.json({
    sistema: 'financeiro',
    // Quem fez a consulta, segundo o gateway (nome vem codificado por causa dos acentos).
    consultadoPor: decodeURIComponent(req.header('x-usuario-nome') ?? 'desconhecido'),
    codigoDecisao: req.header('x-codigo-decisao') ?? null,
    lancamentos: [
      { fornecedor: 'Papelaria Central', vencimento: '2026-10-28', valor: 1240.0, situacao: 'Agendado' },
      { fornecedor: 'Serviços de Nuvem Aurora', vencimento: '2026-10-30', valor: 8900.0, situacao: 'Agendado' },
      { fornecedor: 'Manutenção Predial Norte', vencimento: '2026-11-03', valor: 3150.0, situacao: 'Agendado' },
      { fornecedor: 'Consultoria Jurídica Souza', vencimento: '2026-11-05', valor: 6500.0, situacao: 'Pago' },
      { fornecedor: 'Locação de Equipamentos', vencimento: '2026-11-10', valor: 2780.0, situacao: 'Agendado' },
    ],
  })
})

app.listen(Number(process.env.PORT ?? 3000), () => console.log('api-financeiro no ar'))
