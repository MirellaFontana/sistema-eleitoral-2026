-- Anexos em demandas_observadas: áudio de campo, fotos e documentos.
-- Bucket privado, isolado por campanha_id como primeiro segmento do path.

ALTER TABLE demandas_observadas
    ADD COLUMN IF NOT EXISTS anexos TEXT[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'demandas-anexos',
    'demandas-anexos',
    false,
    52428800, -- 50 MB (comporta gravações de áudio longas)
    ARRAY[
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac',
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
);

CREATE POLICY demandas_anexos_select ON storage.objects
    FOR SELECT USING (
        bucket_id = 'demandas-anexos'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
    );

-- Qualquer papel interno pode subir anexo (captador de campo incluso)
CREATE POLICY demandas_anexos_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'demandas-anexos'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
    );

-- Só coordenadores excluem
CREATE POLICY demandas_anexos_delete ON storage.objects
    FOR DELETE USING (
        bucket_id = 'demandas-anexos'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );
