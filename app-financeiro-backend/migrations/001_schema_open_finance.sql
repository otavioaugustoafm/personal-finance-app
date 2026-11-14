-- =====================================================================
-- 001 - Novo esquema (Open Finance / Meu Pluggy, usuario unico)
--
-- ATENCAO: este script APAGA as tabelas da versao anterior
-- (usuarios, entradas, saidas, categorias, carteira, ativos, transacoes).
-- Antes de rodar, crie uma branch de backup no Neon (Branches > Create branch).
--
-- Como rodar:  psql "$DATABASE_URL" -f migrations/001_schema_open_finance.sql
-- =====================================================================
BEGIN;

-- ---------- limpeza da versao anterior ----------
DROP TABLE IF EXISTS transacoes     CASCADE;  -- a antiga era de investimentos
DROP TABLE IF EXISTS carteira       CASCADE;
DROP TABLE IF EXISTS ativos         CASCADE;
DROP TABLE IF EXISTS entradas       CASCADE;
DROP TABLE IF EXISTS saidas         CASCADE;
DROP TABLE IF EXISTS categorias     CASCADE;
DROP TABLE IF EXISTS usuarios       CASCADE;

-- ---------- categorias (criadas por voce) ----------
CREATE TABLE categorias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL CHECK (length(btrim(nome)) > 0),
  tipo       TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
  cor        TEXT CHECK (cor ~ '^#[0-9a-fA-F]{6}$'),
  arquivada  BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nome, tipo)
);

-- ---------- conexao com o agregador (um "item" do Meu Pluggy) ----------
CREATE TABLE conexoes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provedor                 TEXT NOT NULL DEFAULT 'PLUGGY',
  provedor_item_id         TEXT NOT NULL,
  instituicao              TEXT NOT NULL DEFAULT 'Santander',
  status                   TEXT,
  ultima_sincronizacao_em  TIMESTAMPTZ,
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provedor, provedor_item_id)
);

-- ---------- contas da conexao (conta corrente e cartao de credito) ----------
CREATE TABLE contas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conexao_id            UUID NOT NULL REFERENCES conexoes(id) ON DELETE CASCADE,
  provedor_conta_id     TEXT NOT NULL,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('CORRENTE', 'CARTAO_CREDITO')),
  nome                  TEXT,
  saldo                 NUMERIC(14,2),
  saldo_atualizado_em   TIMESTAMPTZ,
  UNIQUE (conexao_id, provedor_conta_id)
);

-- ---------- livro-razao: tudo que veio do banco ----------
CREATE TABLE transacoes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id               UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  provedor_transacao_id  TEXT NOT NULL,                  -- chave de idempotencia
  data                   DATE NOT NULL,
  descricao              TEXT NOT NULL,
  valor                  NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  direcao                TEXT NOT NULL CHECK (direcao IN ('ENTRADA', 'SAIDA')),
  metodo                 TEXT NOT NULL CHECK (metodo IN ('PIX', 'DEBITO', 'CREDITO', 'OUTRO')),
  status                 TEXT NOT NULL DEFAULT 'EFETIVADA' CHECK (status IN ('PENDENTE', 'EFETIVADA')),
  parcela_atual          INT,
  total_parcelas         INT,
  categoria_id           UUID REFERENCES categorias(id) ON DELETE SET NULL,
  ignorar_no_fluxo       BOOLEAN NOT NULL DEFAULT FALSE, -- ex.: pagamento de fatura (evita contar em dobro)
  bruto                  JSONB,                          -- payload original, para reprocessar sem nova consulta
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conta_id, provedor_transacao_id)
);
CREATE INDEX transacoes_data_idx      ON transacoes (data DESC);
CREATE INDEX transacoes_categoria_idx ON transacoes (categoria_id);

-- ---------- log das sincronizacoes diarias ----------
CREATE TABLE sincronizacoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciada_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizada_em  TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK (status IN ('EM_ANDAMENTO', 'OK', 'ERRO')),
  novas          INT NOT NULL DEFAULT 0,
  atualizadas    INT NOT NULL DEFAULT 0,
  erro           TEXT
);

COMMIT;
