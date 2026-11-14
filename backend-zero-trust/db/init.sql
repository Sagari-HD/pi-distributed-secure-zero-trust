-- ============================================================================
-- Esquema do banco (roda sozinho na primeira subida do Postgres).
-- ============================================================================

-- Registro de auditoria: UMA linha por decisão de acesso (permitida ou negada).
-- Alimenta o painel de auditoria (Tela 5). O "id" gera o código da decisão
-- mostrado ao usuário na Tela 4 (ex.: id 38 -> "D-0038").
CREATE TABLE IF NOT EXISTS decisoes (
  id           SERIAL PRIMARY KEY,
  momento      TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id   TEXT,                 -- "sub" do token (pode ser nulo se o token for inválido)
  usuario_nome TEXT,
  sistema      TEXT NOT NULL,        -- 'financeiro' ou 'rh'
  permitido    BOOLEAN NOT NULL,
  motivos      TEXT[] NOT NULL DEFAULT '{}',  -- ex.: {fora_do_horario}
  dispositivo  TEXT,                 -- postura do dispositivo informada na requisição
  caminho      TEXT                  -- rota acessada, ex.: /lancamentos
);

-- Pedidos de acesso (Telas 8 e 9). Módulo opcional do protótipo.
CREATE TABLE IF NOT EXISTS solicitacoes (
  id              SERIAL PRIMARY KEY,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id      TEXT NOT NULL,
  usuario_nome    TEXT NOT NULL,
  sistema         TEXT NOT NULL,
  codigo_decisao  TEXT NOT NULL,     -- decisão que bloqueou o acesso (Tela 4)
  motivos         TEXT[] NOT NULL DEFAULT '{}',  -- motivo do bloqueio, copiado da decisão (Tela 9)
  justificativa   TEXT NOT NULL,
  periodo_horas   INTEGER NOT NULL,  -- por quanto tempo o acesso temporário vale
  status          TEXT NOT NULL DEFAULT 'pendente',  -- pendente | aprovada | negada
  aprovador_nome  TEXT,
  decidido_em     TIMESTAMPTZ
);
