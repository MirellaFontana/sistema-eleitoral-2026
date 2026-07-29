-- Os 4 buckets privados (0004, 0007, 0041, 0053) nunca definiram file_size_limit nem
-- allowed_mime_types — qualquer usuário autenticado da campanha podia subir um arquivo de
-- qualquer tamanho/tipo pra dentro da própria pasta. RLS já isola por campanha_id, mas nada
-- impedia abuso de custo de armazenamento ou upload de tipo inesperado. Os limites abaixo
-- seguem o que cada tela já envia (ver `accept=` nos forms client-side).

UPDATE storage.buckets SET
    file_size_limit = 10485760, -- 10MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'fotos-campanha';

UPDATE storage.buckets SET
    file_size_limit = 26214400, -- 25MB
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'base-conhecimento';

UPDATE storage.buckets SET
    file_size_limit = 26214400, -- 25MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'pecas-arte';

UPDATE storage.buckets SET
    file_size_limit = 52428800, -- 50MB (capturas de vídeo/áudio de monitoramento)
    allowed_mime_types = ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'application/pdf'
    ]
WHERE id = 'monitoramento';
