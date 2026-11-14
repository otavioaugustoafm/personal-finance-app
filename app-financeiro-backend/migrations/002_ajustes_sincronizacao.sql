-- =====================================================================
-- 002 - Ajustes para a sincronizacao com o Meu Pluggy
--
-- Rode DEPOIS do 001 (se voce ja rodou o 001, rode so este).
--   psql "$DATABASE_URL" -f migrations/002_ajustes_sincronizacao.sql
-- ou cole no SQL Editor do Neon.
-- =====================================================================
BEGIN;

-- Contas poupanca tambem podem vir do banco
ALTER TABLE contas DROP CONSTRAINT contas_tipo_check;
ALTER TABLE contas ADD CONSTRAINT contas_tipo_check
  CHECK (tipo IN ('CORRENTE', 'POUPANCA', 'CARTAO_CREDITO'));

-- A autorizacao do Meu Pluggy expira em 1 ano: guardamos a data para avisar antes
ALTER TABLE conexoes ADD COLUMN consentimento_expira_em TIMESTAMPTZ;

ALTER TABLE transacoes
  ADD COLUMN operacao       TEXT,                  -- operationType do banco (PIX, PAGAMENTO_FATURA...)
  ADD COLUMN provedor_id    TEXT,                  -- providerId (so existe em conexoes Open Finance regulado)
  ADD COLUMN sumiu_em       TIMESTAMPTZ,           -- o banco deixou de reportar; reaparece = volta a NULL
  ADD COLUMN atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX transacoes_ativas_idx ON transacoes (data DESC) WHERE sumiu_em IS NULL;

ALTER TABLE sincronizacoes DROP CONSTRAINT sincronizacoes_status_check;
ALTER TABLE sincronizacoes ADD CONSTRAINT sincronizacoes_status_check
  CHECK (status IN ('EM_ANDAMENTO', 'OK', 'PARCIAL', 'ERRO'));
ALTER TABLE sincronizacoes ADD COLUMN avisos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
