-- Peças de conteúdo passa a receber upload da arte final feita pela equipe,
-- e ganha um veredicto de revisão da IA sobre compliance eleitoral
-- (número, nome de urna, CNPJ, coligação, selo IA no rodapé, difamação, astroturfing).

ALTER TABLE pecas_conteudo
    ADD COLUMN arte_path TEXT,               -- caminho do arquivo no bucket pecas-arte
    ADD COLUMN arte_mime TEXT,               -- mime do upload (image/png, image/jpeg, etc.)
    ADD COLUMN revisao_ia_json JSONB,        -- resultado estruturado da revisão IA
    ADD COLUMN revisao_ia_em TIMESTAMPTZ;    -- quando a revisão rodou

-- Bucket para as artes finais que a equipe sobe (fica isolado por campanha_id na 1ª pasta).
INSERT INTO storage.buckets (id, name, public)
VALUES ('pecas-arte', 'pecas-arte', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: mesmo padrão do bucket fotos-campanha — leitura para membros da campanha,
-- escrita para quem produz conteúdo (coord_campanha, coord_marketing, redator_marketing).
CREATE POLICY pecas_arte_storage_select ON storage.objects
    FOR SELECT USING (
        bucket_id = 'pecas-arte'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
    );

CREATE POLICY pecas_arte_storage_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'pecas-arte'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
    );

CREATE POLICY pecas_arte_storage_update ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'pecas-arte'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
    );

CREATE POLICY pecas_arte_storage_delete ON storage.objects
    FOR DELETE USING (
        bucket_id = 'pecas-arte'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
    );
