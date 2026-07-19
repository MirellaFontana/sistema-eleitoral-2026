-- Consultar/editar/desativar eleitor (ref. specs.md [2026-07-18] "Editar, consultar e desativar
-- cadastros — começando por eleitores"). cidadão não tem policy de DELETE desde a migration 0001
-- por decisão deliberada (rastro de consentimento LGPD via consentimentos_lgpd, append-only) —
-- "apagar" aqui significa desativar (status), nunca remover a linha.

CREATE TYPE status_cidadao AS ENUM ('ativo', 'inativo');

ALTER TABLE cidadaos ADD COLUMN status status_cidadao NOT NULL DEFAULT 'ativo';

-- Sem policy nova: cidadaos_update_coord (migration 0001) já libera UPDATE de qualquer coluna,
-- inclusive a nova, pra coord_campanha — mesma trava de sempre (só quem já vê PII nominal edita).
