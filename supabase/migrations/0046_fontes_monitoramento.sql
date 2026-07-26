CREATE TYPE tier_fonte AS ENUM ('tier1_megafone', 'tier1_politica', 'tier1_cbn', 'tier2_regional');

CREATE TABLE fontes_monitoramento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    dominio TEXT NOT NULL,
    nome TEXT NOT NULL,
    tier tier_fonte NOT NULL DEFAULT 'tier2_regional',
    regiao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_dominio_por_campanha UNIQUE (campanha_id, dominio)
);

CREATE INDEX idx_fontes_monitoramento_campanha ON fontes_monitoramento (campanha_id);

ALTER TABLE fontes_monitoramento ENABLE ROW LEVEL SECURITY;
ALTER TABLE fontes_monitoramento FORCE ROW LEVEL SECURITY;

CREATE POLICY fontes_monitoramento_select ON fontes_monitoramento
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY fontes_monitoramento_insert ON fontes_monitoramento
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('registrar_monitoramento')
    );

CREATE POLICY fontes_monitoramento_update ON fontes_monitoramento
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('registrar_monitoramento'))
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY fontes_monitoramento_delete ON fontes_monitoramento
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND has_permission('registrar_monitoramento')
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON fontes_monitoramento TO authenticated;
