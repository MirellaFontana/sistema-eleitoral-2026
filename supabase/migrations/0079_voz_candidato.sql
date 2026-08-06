-- Campo "voz do candidato": transcrições de falas reais (entrevistas, debates, conversas)
-- que a IA usa como referência de estilo para humanizar os textos gerados.
ALTER TABLE campanhas
  ADD COLUMN voz_candidato TEXT;
