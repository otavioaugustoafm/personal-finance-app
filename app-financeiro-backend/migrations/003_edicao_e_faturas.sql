-- =====================================================================
-- 003 - Edicao manual de transacoes + faturas do cartao
--
-- Rode DEPOIS do 001 e do 002 (se ja rodou os dois, rode so este).
-- =====================================================================
BEGIN;

-- Edicao: o que o BANCO disse (original) fica guardado a parte do que VOCE editou.
-- campos_editados lista o que voce mudou; a sincronizacao nao sobrescreve esses campos.
ALTER TABLE transacoes
  ADD COLUMN campos_editados TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN original        JSONB;

UPDATE transacoes SET original = jsonb_build_object(
  'descricao', descricao, 'data', data::text, 'valor', valor::text, 'direcao', direcao,
  'metodo', metodo, 'parcela_atual', parcela_atual, 'total_parcelas', total_parcelas)
WHERE original IS NULL;

ALTER TABLE transacoes ALTER COLUMN original SET NOT NULL;

-- Dados extras da conta (limite total e disponivel do cartao, por exemplo)
ALTER TABLE contas ADD COLUMN detalhes JSONB;

-- Faturas do cartao de credito (GET /bills do Pluggy)
CREATE TABLE faturas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id            UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  provedor_fatura_id  TEXT NOT NULL,
  vencimento          DATE NOT NULL,
  fechamento          DATE,
  total               NUMERIC(14,2) NOT NULL,
  minimo              NUMERIC(14,2),
  pagamentos          NUMERIC(14,2) NOT NULL DEFAULT 0,
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conta_id, provedor_fatura_id)
);
CREATE INDEX faturas_vencimento_idx ON faturas (vencimento);

COMMIT;
