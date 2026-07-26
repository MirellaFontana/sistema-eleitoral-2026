-- Briefing Diário do Candidato — resumo gerado por IA cruzando a agenda do dia com
-- demandas observadas da região, lideranças vinculadas ao evento e base de conhecimento.
-- (ref. specs.md [2026-07-24] "Briefing Diário do Candidato")
--
-- Decisões:
-- - Histórico completo preservado (sem UNIQUE por data) — regenerar no mesmo dia cria
--   nova linha; a UI mostra o mais recente. Auditoria de qual modelo gerou e com que
--   contexto, mesmo padrão de sugestoes_conteudo/analises_campanha (0011).
-- - Nenhum dado nominal de eleitor entra no briefing: só agenda, território, demandas
--   regionais (sem autor), lideranças já cadastradas e base de conhecimento.

CREATE TABLE briefings_diarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id     UUID NOT NULL REFERENCES campanhas(id),
    data            DATE NOT NULL,
    conteudo        TEXT NOT NULL,            -- o briefing gerado (markdown leve)
    contexto_usado  TEXT NOT NULL,            -- resumo do contexto enviado à IA (auditoria)
    modelo_ia       TEXT NOT NULL,
    gerado_por      UUID REFERENCES usuarios_internos(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_briefings_diarios_campanha_data ON briefings_diarios (campanha_id, data DESC, created_at DESC);

ALTER TABLE briefings_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings_diarios FORCE ROW LEVEL SECURITY;

-- Leitura: todo papel interno ativo da campanha (o briefing é derivado de dados que
-- todos já leem — agenda, demandas, lideranças). Escrita: candidato (é o dono do
-- briefing) ou quem tem a permissão delegável de usar IA. Sem UPDATE/DELETE — o
-- histórico de briefings é imutável, como as demais gerações de IA.
CREATE POLICY briefings_diarios_select ON briefings_diarios
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY briefings_diarios_insert ON briefings_diarios
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND (current_papel() = 'candidato' OR has_permission('usar_ia'))
    );

GRANT SELECT, INSERT ON briefings_diarios TO authenticated;
REVOKE ALL ON briefings_diarios FROM anon;
