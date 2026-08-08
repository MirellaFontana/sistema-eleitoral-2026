CREATE TABLE propostas_publicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    publico TEXT NOT NULL,
    demandas_reclamacoes TEXT,
    propostas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(campanha_id, publico)
);

CREATE INDEX idx_propostas_publicos_campanha ON propostas_publicos (campanha_id);

ALTER TABLE propostas_publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas_publicos FORCE ROW LEVEL SECURITY;

CREATE POLICY propostas_publicos_select ON propostas_publicos
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY propostas_publicos_insert ON propostas_publicos
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'));
CREATE POLICY propostas_publicos_update ON propostas_publicos
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'))
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY propostas_publicos_delete ON propostas_publicos
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'));

GRANT SELECT, INSERT, UPDATE, DELETE ON propostas_publicos TO authenticated;
