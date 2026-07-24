-- 1. Campo de conteúdo em pecas_conteudo (texto gerado pela IA ou digitado manualmente)
ALTER TABLE pecas_conteudo ADD COLUMN conteudo TEXT;

-- 2. Fotos oficiais do candidato / campanha
CREATE TYPE tipo_foto_campanha AS ENUM (
    'foto_oficial',
    'foto_campanha',
    'foto_corpo_inteiro',
    'logo_campanha',
    'logo_partido',
    'fundo_padrao'
);

CREATE TABLE fotos_campanha (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    tipo        tipo_foto_campanha NOT NULL,
    path        TEXT NOT NULL,
    nome_original TEXT NOT NULL,
    largura     INT,
    altura      INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campanha_id, tipo)
);

CREATE INDEX idx_fotos_campanha_campanha ON fotos_campanha (campanha_id);

ALTER TABLE fotos_campanha ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_campanha FORCE ROW LEVEL SECURITY;

-- Leitura: todos os membros ativos da campanha
CREATE POLICY fotos_campanha_select ON fotos_campanha
    FOR SELECT USING (campanha_id = current_campanha_id());

-- Escrita: só coord_campanha
CREATE POLICY fotos_campanha_insert ON fotos_campanha
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() = 'coord_campanha'
    );

CREATE POLICY fotos_campanha_update ON fotos_campanha
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha')
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY fotos_campanha_delete ON fotos_campanha
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND current_papel() = 'coord_campanha'
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON fotos_campanha TO authenticated;
REVOKE ALL ON fotos_campanha FROM anon;

-- 3. Bucket de Storage para fotos da campanha
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-campanha', 'fotos-campanha', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: upload/download restrito à própria campanha
CREATE POLICY fotos_campanha_storage_select ON storage.objects
    FOR SELECT USING (
        bucket_id = 'fotos-campanha'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
    );

CREATE POLICY fotos_campanha_storage_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'fotos-campanha'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() = 'coord_campanha'
    );

CREATE POLICY fotos_campanha_storage_update ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'fotos-campanha'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() = 'coord_campanha'
    );

CREATE POLICY fotos_campanha_storage_delete ON storage.objects
    FOR DELETE USING (
        bucket_id = 'fotos-campanha'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() = 'coord_campanha'
    );
