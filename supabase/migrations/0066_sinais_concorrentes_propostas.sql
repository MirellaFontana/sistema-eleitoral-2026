-- CompetitorSignal: inteligência temporal sobre concorrentes
-- Proposal: propostas estruturadas ligadas a temas

CREATE TYPE tipo_sinal_concorrente AS ENUM (
    'declaracao', 'evento', 'alianca', 'propaganda', 'pesquisa', 'midia', 'juridico', 'outro'
);

CREATE TABLE sinais_concorrentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    concorrente_id UUID NOT NULL REFERENCES concorrentes(id) ON DELETE CASCADE,

    tipo tipo_sinal_concorrente NOT NULL DEFAULT 'outro',
    titulo TEXT NOT NULL,
    descricao TEXT,
    fonte TEXT,
    url TEXT,
    data_ocorrencia DATE,
    impacto TEXT,
    resposta_sugerida TEXT,

    registrado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sinais_concorrentes_campanha ON sinais_concorrentes (campanha_id, created_at DESC);
CREATE INDEX idx_sinais_concorrentes_concorrente ON sinais_concorrentes (concorrente_id);

ALTER TABLE sinais_concorrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinais_concorrentes FORCE ROW LEVEL SECURITY;

CREATE POLICY sinais_concorrentes_select ON sinais_concorrentes
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY sinais_concorrentes_insert ON sinais_concorrentes
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND registrado_por = auth.uid()
    );

CREATE POLICY sinais_concorrentes_update ON sinais_concorrentes
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'))
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY sinais_concorrentes_delete ON sinais_concorrentes
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'));

GRANT SELECT, INSERT, UPDATE, DELETE ON sinais_concorrentes TO authenticated;

-- Propostas da campanha
CREATE TYPE status_proposta AS ENUM ('rascunho', 'em_revisao', 'aprovada', 'descartada');

CREATE TABLE propostas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    tema TEXT,
    territorio TEXT,
    publico_alvo TEXT,
    status status_proposta NOT NULL DEFAULT 'rascunho',
    fundamentacao TEXT,
    impacto_estimado TEXT,
    custo_estimado TEXT,
    prazo TEXT,

    aprovada_por UUID REFERENCES usuarios_internos(id),
    aprovada_em TIMESTAMPTZ,

    criado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_propostas_campanha ON propostas (campanha_id, status);
CREATE INDEX idx_propostas_tema ON propostas (campanha_id, tema);

ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas FORCE ROW LEVEL SECURITY;

CREATE POLICY propostas_select ON propostas
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY propostas_insert ON propostas
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'candidato', 'coord_marketing')
    );

CREATE POLICY propostas_update ON propostas
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'candidato'))
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY propostas_delete ON propostas
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha'));

GRANT SELECT, INSERT, UPDATE, DELETE ON propostas TO authenticated;

-- Auditoria
CREATE TRIGGER trg_audit_sinais_concorrentes
    AFTER INSERT OR UPDATE ON sinais_concorrentes
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trg_audit_propostas
    AFTER INSERT OR UPDATE ON propostas
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
