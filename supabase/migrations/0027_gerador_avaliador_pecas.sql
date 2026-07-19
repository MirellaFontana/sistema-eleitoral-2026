-- Módulo 4 — Marketing: gerador de peças por formato + avaliador de peças produzidas pelo marketing.
--
-- Duas funções de IA:
--   1. GERAR — sugere estrutura, texto e roteiro de uma peça (não produz a arte nem publica).
--   2. AVALIAR — avalia uma peça que o humano já criou em 4 dimensões:
--      legislação eleitoral · boas práticas de mídia · viralidade · clareza e eficácia.
--
-- Ref. Resolução TSE 23.732/2024 (rotulagem de IA em material eleitoral).

-- 1. Expande o enum formato_sugestao_conteudo com os novos tipos de peça.
--    ALTER TYPE ADD VALUE não pode rodar dentro de transação em PG < 12;
--    Supabase usa PG 15+, então está ok.
ALTER TYPE formato_sugestao_conteudo ADD VALUE IF NOT EXISTS 'reel';
ALTER TYPE formato_sugestao_conteudo ADD VALUE IF NOT EXISTS 'stories';
ALTER TYPE formato_sugestao_conteudo ADD VALUE IF NOT EXISTS 'thread';
ALTER TYPE formato_sugestao_conteudo ADD VALUE IF NOT EXISTS 'live';

-- 2. Tabela de avaliações de peças produzidas pela equipe de marketing.
--    Append-only (histórico de auditoria de compliance) — sem UPDATE/DELETE.
--    formato é TEXT (não o enum) para aceitar qualquer formato sem precisar de nova migration.
CREATE TABLE IF NOT EXISTS avaliacoes_pecas (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id    UUID        NOT NULL REFERENCES campanhas(id),
    formato        TEXT        NOT NULL,
    canal          TEXT        NOT NULL,          -- ex: instagram, tiktok, facebook, whatsapp
    descricao_peca TEXT        NOT NULL,          -- texto/descrição da peça enviada pelo usuário
    avaliacao_json JSONB       NOT NULL,          -- resultado da IA: 4 dimensões + síntese
    modelo_ia      TEXT        NOT NULL,
    solicitado_por UUID        REFERENCES usuarios_internos(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_avaliacoes_pecas_campanha ON avaliacoes_pecas (campanha_id, created_at DESC);

ALTER TABLE avaliacoes_pecas ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes_pecas FORCE ROW LEVEL SECURITY;

-- Leitura: todos os internos da campanha (jurídico precisa ver histórico de compliance)
CREATE POLICY avaliacoes_pecas_select ON avaliacoes_pecas
    FOR SELECT USING (campanha_id = current_campanha_id());

-- Inserção: marketing + jurídico + coord_campanha
CREATE POLICY avaliacoes_pecas_insert ON avaliacoes_pecas
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN (
            'coord_campanha',
            'coord_marketing',
            'redator_marketing',
            'advogado_responsavel',
            'assistente_juridico'
        )
    );

GRANT SELECT, INSERT ON avaliacoes_pecas TO authenticated;
REVOKE ALL ON avaliacoes_pecas FROM anon;
