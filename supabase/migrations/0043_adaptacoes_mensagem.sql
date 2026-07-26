-- Central de Copywriting e Adaptação de Mensagens (Dia 4 do plano de inteligência).
-- (ref. specs.md [2026-07-24] "Central de Copywriting")
--
-- A campanha entra com uma MENSAGEM CENTRAL (mensagem-mãe: uma proposta, uma resposta,
-- um posicionamento) e a IA gera N VARIAÇÕES adaptadas a diferentes públicos+canais
-- (WhatsApp para idosos, post para Instagram, e-mail para empresários, etc.) — respeitando
-- a persona da campanha, sem inventar fatos novos, sem alterar a essência da mensagem.
--
-- Cada linha é UMA variação; o `lote_id` agrupa variações geradas juntas da mesma
-- mensagem central (permite listar "essa mensagem central gerou essas 5 variações").

CREATE TABLE adaptacoes_mensagem (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id       UUID NOT NULL REFERENCES campanhas(id),
    lote_id           UUID NOT NULL,             -- agrupa variações da mesma mensagem central
    mensagem_central  TEXT NOT NULL,             -- guardada em toda linha do lote pra facilitar consulta
    publico_alvo      TEXT NOT NULL,             -- ex.: "idosos", "empresários", "jovens"
    canal             TEXT NOT NULL,             -- ex.: "whatsapp", "instagram_post", "email"
    variacao          TEXT NOT NULL,             -- texto gerado pela IA
    modelo_ia         TEXT NOT NULL,
    solicitado_por    UUID REFERENCES usuarios_internos(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adaptacoes_mensagem_campanha  ON adaptacoes_mensagem (campanha_id, created_at DESC);
CREATE INDEX idx_adaptacoes_mensagem_lote      ON adaptacoes_mensagem (lote_id);

ALTER TABLE adaptacoes_mensagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptacoes_mensagem FORCE ROW LEVEL SECURITY;

-- Mesmo padrão de sugestoes_conteudo (Módulo 4): quem gera é quem tem permissão delegável
-- 'usar_ia' (migration 0040). Sem UPDATE/DELETE — geração de IA é histórico imutável.
CREATE POLICY adaptacoes_mensagem_select ON adaptacoes_mensagem
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY adaptacoes_mensagem_insert ON adaptacoes_mensagem
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('usar_ia')
    );

GRANT SELECT, INSERT ON adaptacoes_mensagem TO authenticated;
REVOKE ALL ON adaptacoes_mensagem FROM anon;
