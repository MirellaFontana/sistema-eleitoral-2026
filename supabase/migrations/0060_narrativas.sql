-- Narrativas e Ressonância — análise comparativa de narrativas próprias vs concorrentes
-- por tema, território, período e canal.
-- Ressonância = leitura combinada de alcance, engajamento, imprensa, demandas,
-- escuta de campo, perguntas recebidas, agenda e reações pós-evento.

CREATE TABLE narrativas_analises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    -- Resultado estruturado da análise (array de temas com comparações)
    analise JSONB NOT NULL DEFAULT '[]',

    -- Resumo executivo gerado pela IA
    resumo TEXT,

    -- Metadados
    provedor_ia TEXT,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_narrativas_campanha ON narrativas_analises (campanha_id, created_at DESC);

ALTER TABLE narrativas_analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrativas_analises FORCE ROW LEVEL SECURITY;

CREATE POLICY narrativas_select ON narrativas_analises
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY narrativas_insert ON narrativas_analises
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'candidato', 'coord_marketing')
    );

GRANT SELECT, INSERT ON narrativas_analises TO authenticated;
