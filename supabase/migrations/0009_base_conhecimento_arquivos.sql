-- Editar/excluir item + múltiplos arquivos por item (ref. specs.md [2026-07-13]
-- "Editar/excluir item + múltiplos arquivos por item"). Arquivo vira tabela própria
-- (item -> muitos arquivos) em vez de coluna única em base_conhecimento_itens.

CREATE TABLE base_conhecimento_arquivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES base_conhecimento_itens(id) ON DELETE CASCADE,
    campanha_id UUID NOT NULL REFERENCES campanhas(id), -- denormalizado: RLS direta sem join
    arquivo_path TEXT NOT NULL,
    arquivo_nome_original TEXT,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_base_conhecimento_arquivos_item ON base_conhecimento_arquivos (item_id);
CREATE INDEX idx_base_conhecimento_arquivos_campanha ON base_conhecimento_arquivos (campanha_id);

ALTER TABLE base_conhecimento_arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE base_conhecimento_arquivos FORCE ROW LEVEL SECURITY;

CREATE POLICY base_conhecimento_arquivos_select ON base_conhecimento_arquivos
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY base_conhecimento_arquivos_insert ON base_conhecimento_arquivos
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );

CREATE POLICY base_conhecimento_arquivos_delete ON base_conhecimento_arquivos
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );

GRANT SELECT, INSERT, DELETE ON base_conhecimento_arquivos TO authenticated;

-- Migra o dado que já existe (arquivo_path/arquivo_nome_original em base_conhecimento_itens)
-- pra tabela nova antes de remover as colunas — não pode perder o que já foi cadastrado.
INSERT INTO base_conhecimento_arquivos (item_id, campanha_id, arquivo_path, arquivo_nome_original, criado_por, created_at)
SELECT id, campanha_id, arquivo_path, arquivo_nome_original, criado_por, created_at
FROM base_conhecimento_itens
WHERE arquivo_path IS NOT NULL;

-- A CHECK descricao_ou_arquivo não faz mais sentido (arquivo não é mais coluna desta tabela;
-- "tem pelo menos 1 arquivo" exigiria trigger, não CHECK simples). Vira validação só de UI.
ALTER TABLE base_conhecimento_itens DROP CONSTRAINT descricao_ou_arquivo;
ALTER TABLE base_conhecimento_itens DROP COLUMN arquivo_path;
ALTER TABLE base_conhecimento_itens DROP COLUMN arquivo_nome_original;

-- Editar título/descrição já é coberto pela policy `base_conhecimento_itens_update` existente
-- (migration 0004/0006) — mesma condição (coord_campanha/coord_marketing), não precisa de policy
-- nova. Duas policies permissivas com a mesma condição pra UPDATE seria redundante, não incorreto,
-- mas sem motivo pra existir.
