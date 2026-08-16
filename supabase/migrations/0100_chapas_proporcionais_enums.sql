-- ============================================================================
-- MÓDULO: CHAPAS PROPORCIONAIS — ENUMS E PERMISSÕES
-- ============================================================================

-- Status da chapa
CREATE TYPE status_chapa AS ENUM (
  'rascunho',
  'em_composicao',
  'completa',
  'registrada',
  'arquivada'
);

-- Status da candidatura dentro da chapa
CREATE TYPE status_candidatura_chapa AS ENUM (
  'confirmado',
  'provavel',
  'convidado',
  'descartado'
);

-- Gênero para cota eleitoral
CREATE TYPE genero_candidatura AS ENUM (
  'masculino',
  'feminino'
);

-- Classificação de competitividade
CREATE TYPE classificacao_competitividade AS ENUM (
  'muito_competitivo',
  'competitivo',
  'intermediario',
  'composicao',
  'baixa'
);

-- Tipo de cenário de simulação
CREATE TYPE tipo_cenario AS ENUM (
  'conservador',
  'base',
  'otimista'
);

-- Cargo proporcional
CREATE TYPE cargo_proporcional AS ENUM (
  'deputado_federal',
  'deputado_estadual',
  'deputado_distrital',
  'vereador'
);

-- Permissões
ALTER TYPE permissao_sistema ADD VALUE IF NOT EXISTS 'ver_chapas_proporcionais';
ALTER TYPE permissao_sistema ADD VALUE IF NOT EXISTS 'gerenciar_chapas_proporcionais';
