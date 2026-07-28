-- Ciclo completo de decisão: Evidência → Decisão → Ação → Resultado
-- Conecta recomendações, sinais e propostas a decisões rastreáveis

CREATE TYPE status_decisao AS ENUM (
    'rascunho',
    'decidida',
    'em_execucao',
    'concluida',
    'cancelada'
);

CREATE TABLE decisoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    -- O quê
    titulo TEXT NOT NULL,
    descricao TEXT,
    status status_decisao NOT NULL DEFAULT 'rascunho',

    -- Evidência (de onde veio)
    evidencias JSONB NOT NULL DEFAULT '[]',
    -- ex: [{"tipo":"recomendacao","id":"uuid","titulo":"..."},
    --      {"tipo":"sinal_campo","id":"uuid","resumo":"..."},
    --      {"tipo":"sinal_concorrente","id":"uuid","titulo":"..."}]

    -- Decisão
    decisao_texto TEXT,
    decidida_por UUID REFERENCES usuarios_internos(id),
    decidida_em TIMESTAMPTZ,

    -- Ação planejada
    acao_planejada TEXT,
    responsavel_id UUID REFERENCES usuarios_internos(id),
    prazo DATE,

    -- Resultado (outcome)
    resultado TEXT,
    resultado_registrado_em TIMESTAMPTZ,

    -- Referências opcionais
    recomendacao_id UUID REFERENCES recomendacoes(id),
    proposta_id UUID,

    -- Meta
    registrado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_decisoes_campanha_status ON decisoes(campanha_id, status);

ALTER TABLE decisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisoes FORCE ROW LEVEL SECURITY;

CREATE POLICY decisoes_select ON decisoes
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY decisoes_insert ON decisoes
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND registrado_por = auth.uid()
    );

CREATE POLICY decisoes_update ON decisoes
    FOR UPDATE USING (
        campanha_id = current_campanha_id()
        AND (current_papel() IN ('coord_campanha', 'candidato') OR registrado_por = auth.uid())
    );

GRANT SELECT, INSERT, UPDATE ON decisoes TO authenticated;

CREATE TRIGGER trg_audit_decisoes
    AFTER INSERT OR UPDATE ON decisoes
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
