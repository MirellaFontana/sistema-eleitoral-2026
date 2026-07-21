-- Adiciona campo "cidade" (texto livre) ao cadastro de eleitor — mesmo padrão já usado em
-- apoiadores e liderancas (migrations 0015/0019). Território continua existindo separadamente,
-- como campo opcional específico para o mapa de cobertura (não é substituído).

ALTER TABLE cidadaos ADD COLUMN IF NOT EXISTS cidade TEXT;
