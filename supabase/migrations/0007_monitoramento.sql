-- Monitoramento (clipping) da campanha na internet — Módulo 2 Campanha (ref. specs.md [2026-07-13]
-- "Monitoramento (clipping)"). Registro manual nesta entrega: alguém da equipe encontra uma menção
-- (ameaça jurídica, deepfake suspeito, menção neutra, oportunidade de marketing) e cadastra aqui.
-- Um único ponto de entrada — não separa jurídico/marketing desde a captação, porque a mesma
-- menção pode interessar aos dois times.

CREATE TYPE categoria_monitoramento AS ENUM (
    'ameaca_juridica', 'deepfake_suspeito', 'mencao_neutra', 'oportunidade_marketing', 'outro'
);
CREATE TYPE gravidade_monitoramento AS ENUM ('baixa', 'media', 'alta');
CREATE TYPE status_monitoramento AS ENUM ('novo', 'em_analise', 'resolvido');

CREATE TABLE monitoramento_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    url TEXT,                     -- nem toda menção tem link público (ex.: print de grupo fechado)
    descricao TEXT NOT NULL,      -- sempre obrigatória: é o "o que foi visto"
    categoria categoria_monitoramento NOT NULL,
    gravidade gravidade_monitoramento,  -- só relevante pras categorias de ameaça; nullable pro resto
    status status_monitoramento NOT NULL DEFAULT 'novo',
    captura_path TEXT,             -- caminho no bucket `monitoramento`: {campanha_id}/{arquivo}
    registrado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_monitoramento_campanha ON monitoramento_itens (campanha_id);
CREATE INDEX idx_monitoramento_categoria ON monitoramento_itens (campanha_id, categoria);

ALTER TABLE monitoramento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoramento_itens FORCE ROW LEVEL SECURITY;

-- Leitura: qualquer papel interno da campanha (mesmo padrão de temas/base de conhecimento) —
-- inclusive embaixador e candidato, que só não podem CRIAR item.
CREATE POLICY monitoramento_itens_select ON monitoramento_itens
    FOR SELECT USING (campanha_id = current_campanha_id());

-- Criação: todo mundo exceto embaixador (papel de campo, não é função dele) e candidato (mantém
-- "só leitura, sem poder administrativo/de conteúdo" já decidido na hierarquia).
CREATE POLICY monitoramento_itens_insert ON monitoramento_itens
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
    );

CREATE POLICY monitoramento_itens_update ON monitoramento_itens
    FOR UPDATE
    USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
    )
    WITH CHECK (campanha_id = current_campanha_id());

GRANT SELECT, INSERT, UPDATE ON monitoramento_itens TO authenticated;

-- Storage: bucket privado, mesmo padrão de path/RLS do base-conhecimento.
INSERT INTO storage.buckets (id, name, public)
VALUES ('monitoramento', 'monitoramento', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY monitoramento_storage_select ON storage.objects
    FOR SELECT USING (
        bucket_id = 'monitoramento'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
    );

CREATE POLICY monitoramento_storage_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'monitoramento'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
    );
