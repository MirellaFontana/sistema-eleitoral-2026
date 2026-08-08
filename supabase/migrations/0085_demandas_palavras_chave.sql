ALTER TABLE demandas_observadas
  ADD COLUMN IF NOT EXISTS palavras_chave TEXT[] NOT NULL DEFAULT '{}';
