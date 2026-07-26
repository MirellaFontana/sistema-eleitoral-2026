-- Renomeia cidade → cidades (TEXT[]) para permitir múltiplas cidades por demanda.
-- Dados existentes migrados: cidade "X" vira ARRAY['X'], NULL vira '{}'.
ALTER TABLE demandas_observadas ADD COLUMN cidades TEXT[] NOT NULL DEFAULT '{}';

UPDATE demandas_observadas
   SET cidades = ARRAY[cidade]
 WHERE cidade IS NOT NULL AND cidade <> '';

ALTER TABLE demandas_observadas DROP COLUMN cidade;
