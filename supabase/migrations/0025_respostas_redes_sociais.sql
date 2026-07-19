-- Sistema "Respostas" (Marketing) — ref. .pipeline/specs.md [2026-07-19] "Reorganização de menu
-- (Demandas, Monitoramento) + novo sistema Respostas (Marketing)". A pessoa cola uma pergunta
-- recebida nas redes sociais e recebe uma resposta sugerida pela IA, usando o conhecimento já
-- cadastrado na campanha (base_conhecimento_itens) como contexto. É rascunho pra revisão humana
-- (mesmo padrão de sugestoes_conteudo, Módulo 4) — o sistema não posta nada sozinho.
--
-- Reaproveita o enum canal_peca_conteudo (migration 0012) em vez de criar um tipo novo.

CREATE TABLE respostas_redes_sociais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    pergunta TEXT NOT NULL,
    canal_origem canal_peca_conteudo NOT NULL DEFAULT 'outro',
    contexto_adicional TEXT,
    resposta_sugerida TEXT NOT NULL,
    modelo_ia TEXT NOT NULL,
    solicitado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_respostas_redes_sociais_campanha ON respostas_redes_sociais (campanha_id);

ALTER TABLE respostas_redes_sociais ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas_redes_sociais FORCE ROW LEVEL SECURITY;

-- Leitura geral (histórico útil pra todo mundo, mesmo padrão de sugestoes_conteudo/analises_campanha).
-- Criação só por quem trabalha marketing + coord_campanha. Sem UPDATE/DELETE — é histórico de
-- auditoria de chamada de IA, não deveria ser editável.
CREATE POLICY respostas_redes_sociais_select ON respostas_redes_sociais
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY respostas_redes_sociais_insert ON respostas_redes_sociais
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
    );

GRANT SELECT, INSERT ON respostas_redes_sociais TO authenticated;
