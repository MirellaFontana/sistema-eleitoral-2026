-- ============================================================================
-- MÓDULO: CHAPAS PROPORCIONAIS — TABELAS
-- ============================================================================

-- 1. REGRAS ELEITORAIS (versionadas por ano)
CREATE TABLE regras_eleitorais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ano             SMALLINT NOT NULL,
    cargo           cargo_proporcional NOT NULL,
    descricao       TEXT,

    -- Limite de candidaturas: formula = vagas + offset
    limite_offset   SMALLINT NOT NULL DEFAULT 1,

    -- Cota de gênero
    cota_genero_min_pct  NUMERIC(5,2) NOT NULL DEFAULT 30.00,
    cota_genero_max_pct  NUMERIC(5,2) NOT NULL DEFAULT 70.00,

    -- Votação individual mínima (% do QE)
    votacao_minima_pct_qe  NUMERIC(5,2) NOT NULL DEFAULT 10.00,

    -- Sobras: % do QE para primeira fase
    sobras_pct_qe_fase1   NUMERIC(5,2) NOT NULL DEFAULT 80.00,
    -- Sobras: % do QE para segunda fase
    sobras_pct_qe_fase2   NUMERIC(5,2) NOT NULL DEFAULT 20.00,

    -- Metadados
    fonte_legal     TEXT,
    notas           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (ano, cargo)
);

-- Seed: regras 2026
INSERT INTO regras_eleitorais (ano, cargo, descricao, limite_offset, cota_genero_min_pct, cota_genero_max_pct, votacao_minima_pct_qe, sobras_pct_qe_fase1, sobras_pct_qe_fase2, fonte_legal) VALUES
  (2026, 'deputado_federal',   'Deputado Federal 2026',   1, 30.00, 70.00, 10.00, 80.00, 20.00, 'Resolução TSE nº 23.748/2026; CE art. 109 e 109-A'),
  (2026, 'deputado_estadual',  'Deputado Estadual 2026',  1, 30.00, 70.00, 10.00, 80.00, 20.00, 'Resolução TSE nº 23.748/2026; CE art. 109 e 109-A'),
  (2026, 'deputado_distrital', 'Deputado Distrital 2026', 1, 30.00, 70.00, 10.00, 80.00, 20.00, 'Resolução TSE nº 23.748/2026; CE art. 109 e 109-A'),
  (2026, 'vereador',           'Vereador 2026',           1, 30.00, 70.00, 10.00, 80.00, 20.00, 'Resolução TSE nº 23.748/2026; CE art. 109 e 109-A');

-- 2. ELEIÇÃO PROPORCIONAL
CREATE TABLE eleicoes_proporcionais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id     UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    cargo           cargo_proporcional NOT NULL,
    estado          CHAR(2) NOT NULL,
    ano             SMALLINT NOT NULL DEFAULT 2026,
    vagas           SMALLINT NOT NULL,
    situacao        TEXT NOT NULL DEFAULT 'ativa',
    observacoes     TEXT,
    criado_por      UUID REFERENCES usuarios_internos(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (campanha_id, cargo, estado, ano)
);

CREATE INDEX idx_eleicoes_prop_campanha ON eleicoes_proporcionais (campanha_id);

-- 3. CHAPA PROPORCIONAL
CREATE TABLE chapas_proporcionais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eleicao_id      UUID NOT NULL REFERENCES eleicoes_proporcionais(id) ON DELETE CASCADE,
    campanha_id     UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,

    -- Identificação
    partido         TEXT NOT NULL,
    federacao       TEXT,
    nome_coligacao  TEXT,

    -- Status
    status          status_chapa NOT NULL DEFAULT 'rascunho',

    -- Votos estimados da legenda (para simulação)
    votos_legenda_estimados  INTEGER DEFAULT 0,

    observacoes     TEXT,
    criado_por      UUID REFERENCES usuarios_internos(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chapas_prop_eleicao ON chapas_proporcionais (eleicao_id);
CREATE INDEX idx_chapas_prop_campanha ON chapas_proporcionais (campanha_id);

-- 4. CANDIDATURA NA CHAPA
CREATE TABLE candidaturas_chapa (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapa_id        UUID NOT NULL REFERENCES chapas_proporcionais(id) ON DELETE CASCADE,
    campanha_id     UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,

    -- Identificação do candidato
    nome            TEXT NOT NULL,
    nome_urna       TEXT,
    numero          TEXT,
    foto_url        TEXT,
    genero          genero_candidatura NOT NULL,

    -- Vínculo opcional com ativos políticos
    ativo_politico_id  UUID REFERENCES ativos_politicos(id) ON DELETE SET NULL,

    -- Status e classificação
    status          status_candidatura_chapa NOT NULL DEFAULT 'convidado',
    competitividade classificacao_competitividade DEFAULT 'intermediario',
    posicao_operacional SMALLINT,

    -- Dados eleitorais
    partido         TEXT,
    votos_historicos    INTEGER,
    votos_projetados    INTEGER,
    votos_atuais        INTEGER,
    fonte_estimativa    TEXT,
    data_estimativa     DATE,

    -- Território
    territorio_principal TEXT,
    municipios_forca     TEXT[],

    -- Capacidade
    potencial_mobilizacao  SMALLINT CHECK (potencial_mobilizacao BETWEEN 1 AND 5),

    -- Observações
    observacoes_estrategicas TEXT,

    criado_por      UUID REFERENCES usuarios_internos(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidaturas_chapa ON candidaturas_chapa (chapa_id);
CREATE INDEX idx_candidaturas_campanha ON candidaturas_chapa (campanha_id);
CREATE INDEX idx_candidaturas_ativo ON candidaturas_chapa (ativo_politico_id);

-- 5. SIMULAÇÕES PROPORCIONAIS
CREATE TABLE simulacoes_proporcionais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eleicao_id      UUID NOT NULL REFERENCES eleicoes_proporcionais(id) ON DELETE CASCADE,
    campanha_id     UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,

    -- Identificação
    titulo          TEXT NOT NULL,
    cenario         tipo_cenario NOT NULL DEFAULT 'base',

    -- Parâmetros de entrada
    votos_validos_estimados  INTEGER NOT NULL,
    dados_partidos           JSONB NOT NULL DEFAULT '[]',
    dados_candidatos         JSONB NOT NULL DEFAULT '[]',

    -- Resultados calculados
    resultado                JSONB NOT NULL DEFAULT '{}',

    -- Versão da regra usada
    regra_eleitoral_id       UUID REFERENCES regras_eleitorais(id),
    versao_calculo           TEXT DEFAULT '2026-v1',

    -- Auditoria
    criado_por      UUID REFERENCES usuarios_internos(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_simulacoes_eleicao ON simulacoes_proporcionais (eleicao_id);
CREATE INDEX idx_simulacoes_campanha ON simulacoes_proporcionais (campanha_id);

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE regras_eleitorais ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras_eleitorais FORCE ROW LEVEL SECURITY;
ALTER TABLE eleicoes_proporcionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE eleicoes_proporcionais FORCE ROW LEVEL SECURITY;
ALTER TABLE chapas_proporcionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapas_proporcionais FORCE ROW LEVEL SECURITY;
ALTER TABLE candidaturas_chapa ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidaturas_chapa FORCE ROW LEVEL SECURITY;
ALTER TABLE simulacoes_proporcionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulacoes_proporcionais FORCE ROW LEVEL SECURITY;

-- Regras eleitorais: leitura pública (dados normativos)
CREATE POLICY "regras_eleitorais_select" ON regras_eleitorais FOR SELECT USING (true);

-- Eleições, chapas, candidaturas, simulações: campanha_id via RLS
CREATE POLICY "eleicoes_prop_select" ON eleicoes_proporcionais FOR SELECT
  USING (campanha_id = current_campanha_id());
CREATE POLICY "eleicoes_prop_insert" ON eleicoes_proporcionais FOR INSERT
  WITH CHECK (campanha_id = current_campanha_id() AND has_permission('gerenciar_chapas_proporcionais'));
CREATE POLICY "eleicoes_prop_update" ON eleicoes_proporcionais FOR UPDATE
  USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_chapas_proporcionais'));
CREATE POLICY "eleicoes_prop_delete" ON eleicoes_proporcionais FOR DELETE
  USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_chapas_proporcionais'));

CREATE POLICY "chapas_prop_select" ON chapas_proporcionais FOR SELECT
  USING (campanha_id = current_campanha_id());
CREATE POLICY "chapas_prop_insert" ON chapas_proporcionais FOR INSERT
  WITH CHECK (campanha_id = current_campanha_id() AND has_permission('gerenciar_chapas_proporcionais'));
CREATE POLICY "chapas_prop_update" ON chapas_proporcionais FOR UPDATE
  USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_chapas_proporcionais'));
CREATE POLICY "chapas_prop_delete" ON chapas_proporcionais FOR DELETE
  USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_chapas_proporcionais'));

CREATE POLICY "candidaturas_select" ON candidaturas_chapa FOR SELECT
  USING (campanha_id = current_campanha_id());
CREATE POLICY "candidaturas_insert" ON candidaturas_chapa FOR INSERT
  WITH CHECK (campanha_id = current_campanha_id() AND has_permission('gerenciar_chapas_proporcionais'));
CREATE POLICY "candidaturas_update" ON candidaturas_chapa FOR UPDATE
  USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_chapas_proporcionais'));
CREATE POLICY "candidaturas_delete" ON candidaturas_chapa FOR DELETE
  USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_chapas_proporcionais'));

CREATE POLICY "simulacoes_select" ON simulacoes_proporcionais FOR SELECT
  USING (campanha_id = current_campanha_id());
CREATE POLICY "simulacoes_insert" ON simulacoes_proporcionais FOR INSERT
  WITH CHECK (campanha_id = current_campanha_id() AND has_permission('gerenciar_chapas_proporcionais'));

-- Adicionar permissões ao bootstrap de funções padrão
-- (has_permission já concede tudo a coord_campanha)
