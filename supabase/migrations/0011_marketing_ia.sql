-- Módulo 4 — Marketing: FAQs, histórico de sugestões de conteúdo geradas por IA, e histórico de
-- análises de campanha (ref. specs.md [2026-07-15] "Módulo 4 — Marketing (planejamento)").
--
-- A IA aqui só sugere (texto/estrutura pra um humano executar a arte/vídeo e publicar) — não
-- produz conteúdo final nem publica. Por isso não há rotulagem visível obrigatória nesta
-- entrega, só um registro leve de auditoria (modelo, quem pediu, quando) em toda chamada.

CREATE TABLE faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    pergunta TEXT NOT NULL,
    resposta TEXT NOT NULL,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE formato_sugestao_conteudo AS ENUM ('post', 'whatsapp', 'carrossel', 'roteiro_video', 'outro');

CREATE TABLE sugestoes_conteudo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    formato formato_sugestao_conteudo NOT NULL,
    contexto_usado TEXT NOT NULL,   -- o que foi mandado como base pra IA (ex. texto da proposta)
    modelo_ia TEXT NOT NULL,        -- ex. "claude-sonnet-5" — auditoria de qual modelo gerou
    sugestao TEXT NOT NULL,         -- resposta da IA
    solicitado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE tipo_analise_campanha AS ENUM ('pontos_cegos');

CREATE TABLE analises_campanha (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    tipo tipo_analise_campanha NOT NULL,
    analise TEXT NOT NULL,
    modelo_ia TEXT NOT NULL,
    solicitado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_faqs_campanha ON faqs (campanha_id);
CREATE INDEX idx_sugestoes_conteudo_campanha ON sugestoes_conteudo (campanha_id);
CREATE INDEX idx_analises_campanha_campanha ON analises_campanha (campanha_id);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs FORCE ROW LEVEL SECURITY;
ALTER TABLE sugestoes_conteudo ENABLE ROW LEVEL SECURITY;
ALTER TABLE sugestoes_conteudo FORCE ROW LEVEL SECURITY;
ALTER TABLE analises_campanha ENABLE ROW LEVEL SECURITY;
ALTER TABLE analises_campanha FORCE ROW LEVEL SECURITY;

-- faqs: diferente da base de conhecimento, redator_marketing TAMBÉM edita (é material de
-- conteúdo do dia a dia dele, não fato institucional trancado a sênior).
CREATE POLICY faqs_select ON faqs
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY faqs_insert ON faqs
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
    );
CREATE POLICY faqs_update ON faqs
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing'))
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY faqs_delete ON faqs
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing'));

-- sugestoes_conteudo / analises_campanha: leitura geral (histórico útil pra todo mundo),
-- criação só por quem trabalha marketing + coord_campanha. Sem UPDATE/DELETE — é histórico
-- de auditoria de chamada de IA, não deveria ser editável.
CREATE POLICY sugestoes_conteudo_select ON sugestoes_conteudo
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY sugestoes_conteudo_insert ON sugestoes_conteudo
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
    );

CREATE POLICY analises_campanha_select ON analises_campanha
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY analises_campanha_insert ON analises_campanha
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON faqs TO authenticated;
GRANT SELECT, INSERT ON sugestoes_conteudo TO authenticated;
GRANT SELECT, INSERT ON analises_campanha TO authenticated;
