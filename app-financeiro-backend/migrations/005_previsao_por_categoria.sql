-- =====================================================================
-- 005 - Previsao ligada a uma categoria (valor automatico)
--
-- Ex.: "Estorno da mae" ligada a "Gastos da Mae": o painel usa como valor o total
-- gasto nessa categoria no periodo, que sobe sozinho a cada novo gasto.
-- Previsao ligada a categoria NAO guarda valor (fica NULL); previsao comum continua com valor fixo.
-- Se a categoria for excluida, as previsoes ligadas a ela sao excluidas junto.
--
-- Rode DEPOIS do 001 a 004 (se ja rodou os quatro, rode so este). Pode rodar no SQL Editor do Neon.
-- =====================================================================
BEGIN;

ALTER TABLE previsoes
  ADD COLUMN categoria_id UUID REFERENCES categorias(id) ON DELETE CASCADE;

ALTER TABLE previsoes ALTER COLUMN valor DROP NOT NULL;

ALTER TABLE previsoes
  ADD CONSTRAINT previsoes_valor_ou_categoria CHECK (
    (categoria_id IS NULL AND valor IS NOT NULL) OR (categoria_id IS NOT NULL AND valor IS NULL)
  );

CREATE INDEX previsoes_categoria_idx ON previsoes (categoria_id);

COMMIT;
