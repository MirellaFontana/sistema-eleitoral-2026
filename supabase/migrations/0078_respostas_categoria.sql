-- Adiciona categoria às respostas para organização por tema (Temas Sensíveis, Saúde, etc.)
ALTER TABLE respostas_redes_sociais
  ADD COLUMN categoria TEXT NOT NULL DEFAULT 'geral';

CREATE INDEX idx_respostas_redes_sociais_categoria ON respostas_redes_sociais (campanha_id, categoria);
