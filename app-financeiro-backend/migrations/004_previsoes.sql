-- =====================================================================
-- 004 - Previsoes (entradas esperadas e saidas previstas) para o "saldo presumido"
--
-- Rode DEPOIS do 001, 002 e 003 (se ja rodou os tres, rode so este).
-- =====================================================================
BEGIN;

CREATE TABLE previsoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo        TEXT NOT NULL CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),  -- "2026-11" = periodo que termina em novembro
  tipo           TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
  descricao      TEXT NOT NULL CHECK (length(btrim(descricao)) > 0),
  valor          NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  concluida      BOOLEAN NOT NULL DEFAULT FALSE,   -- ja recebida/paga: ja esta refletida no saldo, entao nao conta mais
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX previsoes_periodo_idx ON previsoes (periodo);

COMMIT;
