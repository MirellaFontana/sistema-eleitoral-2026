-- Mais 2 bases de conhecimento estruturadas (ref. specs.md [2026-07-13] "Mais 3 bases de
-- conhecimento") — Concorrentes e Demandas (observadas). "Atual Conjuntura" não precisa de
-- schema novo, é só mais um tema na base de conhecimento já existente.
--
-- demandas_observadas é nota de referência regional, NÃO o fluxo formal de cidadão-relata/
-- mandato-encaminha já previsto na especificação (esse continua módulo próprio, futuro, com
-- status e encaminhamento). Nome deliberadamente diferente de `demandas` puro pra não colidir.

CREATE TABLE concorrentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    nome TEXT NOT NULL,
    partido TEXT,
    pontos_fortes TEXT,
    pontos_fracos TEXT,
    promessas TEXT,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE demandas_observadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    regiao TEXT,
    cidade TEXT,
    tema TEXT,
    demanda TEXT NOT NULL,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_concorrentes_campanha ON concorrentes (campanha_id);
CREATE INDEX idx_demandas_observadas_campanha ON demandas_observadas (campanha_id);

ALTER TABLE concorrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE concorrentes FORCE ROW LEVEL SECURITY;
ALTER TABLE demandas_observadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE demandas_observadas FORCE ROW LEVEL SECURITY;

-- Mesmo padrão de acesso da base de conhecimento: leitura pra qualquer papel interno da
-- campanha, edição só coord_campanha/coord_marketing.
CREATE POLICY concorrentes_select ON concorrentes
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY concorrentes_insert ON concorrentes
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'));
CREATE POLICY concorrentes_update ON concorrentes
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'))
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY concorrentes_delete ON concorrentes
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'));

CREATE POLICY demandas_observadas_select ON demandas_observadas
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY demandas_observadas_insert ON demandas_observadas
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'));
CREATE POLICY demandas_observadas_update ON demandas_observadas
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'))
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY demandas_observadas_delete ON demandas_observadas
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'));

GRANT SELECT, INSERT, UPDATE, DELETE ON concorrentes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON demandas_observadas TO authenticated;
