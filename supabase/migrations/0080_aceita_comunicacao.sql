-- Campo opt-in de comunicação: eleitor aceita receber notícias da campanha.
-- Separado do consentimento LGPD (que é obrigatório para cadastro) —
-- este é opcional e pode ser revogado independentemente.
ALTER TABLE cidadaos
  ADD COLUMN aceita_comunicacao BOOLEAN NOT NULL DEFAULT false;
