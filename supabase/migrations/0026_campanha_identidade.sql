-- Migration 0026: dados de identidade eleitoral da campanha
-- Colunas nullable — podem ser preenchidas depois do onboarding, quando o candidato
-- já tiver número registrado no TSE e CNPJ de campanha aberto.

ALTER TABLE campanhas
  ADD COLUMN IF NOT EXISTS numero_candidato TEXT NULL,
  ADD COLUMN IF NOT EXISTS nome_urna        TEXT NULL,
  ADD COLUMN IF NOT EXISTS cnpj_campanha    TEXT NULL,
  ADD COLUMN IF NOT EXISTS coligacao        TEXT NULL;

-- Nenhuma policy nova necessária: campanhas_update já permite coord_campanha
-- com MFA atualizar qualquer coluna de sua própria campanha (migration 0001).
