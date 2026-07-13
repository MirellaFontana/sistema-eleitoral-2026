-- Base de conhecimento da campanha (ref. specs.md [2026-07-13]) — pré-requisito antes do
-- Nível 3 (embaixador) e do Módulo 2 (jurídico): repositório de propostas/biografia/temas
-- que os módulos de geração de conteúdo vão consultar depois. Sem IA/RAG nesta entrega —
-- só estrutura + storage, consulta é manual.

CREATE TABLE temas_campanha (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_tema_por_campanha UNIQUE (campanha_id, nome)
);

CREATE TABLE base_conhecimento_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id), -- denormalizado: RLS direta sem join em temas_campanha
    tema_id UUID NOT NULL REFERENCES temas_campanha(id),
    titulo TEXT NOT NULL,
    descricao TEXT,
    arquivo_path TEXT,          -- caminho no bucket `base-conhecimento`: {campanha_id}/{tema_id}/{arquivo}
    arquivo_nome_original TEXT,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT descricao_ou_arquivo CHECK (descricao IS NOT NULL OR arquivo_path IS NOT NULL)
);

CREATE INDEX idx_temas_campanha_campanha ON temas_campanha (campanha_id);
CREATE INDEX idx_base_conhecimento_campanha ON base_conhecimento_itens (campanha_id);
CREATE INDEX idx_base_conhecimento_tema ON base_conhecimento_itens (tema_id);

ALTER TABLE temas_campanha ENABLE ROW LEVEL SECURITY;
ALTER TABLE temas_campanha FORCE ROW LEVEL SECURITY;
ALTER TABLE base_conhecimento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE base_conhecimento_itens FORCE ROW LEVEL SECURITY;

-- Leitura: qualquer papel interno da própria campanha (mesmo padrão de territorios/usuarios_internos).
CREATE POLICY temas_campanha_select ON temas_campanha
    FOR SELECT USING (campanha_id = current_campanha_id());

-- Edição: coord_campanha OU coord_comunicacao (diferente do padrão de territorios, que é só coord_campanha —
-- aqui coord_comunicacao é quem mais consulta/alimenta essa base no dia a dia).
CREATE POLICY temas_campanha_insert ON temas_campanha
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_comunicacao')
    );

CREATE POLICY temas_campanha_update ON temas_campanha
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_comunicacao'))
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY base_conhecimento_itens_select ON base_conhecimento_itens
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY base_conhecimento_itens_insert ON base_conhecimento_itens
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_comunicacao')
    );

CREATE POLICY base_conhecimento_itens_update ON base_conhecimento_itens
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_comunicacao'))
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY base_conhecimento_itens_delete ON base_conhecimento_itens
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_comunicacao'));

GRANT SELECT, INSERT, UPDATE ON temas_campanha TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON base_conhecimento_itens TO authenticated;

-- 2. STORAGE — bucket privado, path convention: {campanha_id}/{tema_id}/{arquivo}
INSERT INTO storage.buckets (id, name, public)
VALUES ('base-conhecimento', 'base-conhecimento', false)
ON CONFLICT (id) DO NOTHING;

-- O primeiro segmento do path é sempre o campanha_id (texto) — comparação por texto, não UUID,
-- porque storage.foldername retorna text[].
CREATE POLICY base_conhecimento_storage_select ON storage.objects
    FOR SELECT USING (
        bucket_id = 'base-conhecimento'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
    );

CREATE POLICY base_conhecimento_storage_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'base-conhecimento'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'coord_comunicacao')
    );

CREATE POLICY base_conhecimento_storage_update ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'base-conhecimento'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'coord_comunicacao')
    );

CREATE POLICY base_conhecimento_storage_delete ON storage.objects
    FOR DELETE USING (
        bucket_id = 'base-conhecimento'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'coord_comunicacao')
    );
