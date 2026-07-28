-- Saúde e rastreabilidade de fontes públicas
-- + Narrativas com modelo estruturado por território/canal/período

-- ============================================================================
-- 1. SAÚDE DAS FONTES
-- ============================================================================

ALTER TABLE fontes_monitoramento
    ADD COLUMN ultimo_acesso_em TIMESTAMPTZ,
    ADD COLUMN ultimo_status INT,
    ADD COLUMN falhas_consecutivas INT NOT NULL DEFAULT 0,
    ADD COLUMN total_acessos INT NOT NULL DEFAULT 0,
    ADD COLUMN observacoes TEXT;

-- ============================================================================
-- 2. NARRATIVAS ESTRUTURADAS
-- ============================================================================

ALTER TABLE narrativas_analises
    ADD COLUMN territorio_id UUID REFERENCES territorios(id),
    ADD COLUMN canal TEXT,
    ADD COLUMN periodo_inicio DATE,
    ADD COLUMN periodo_fim DATE,
    ADD COLUMN temas TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN tipo TEXT NOT NULL DEFAULT 'comparativa';

CREATE INDEX idx_narrativas_territorio ON narrativas_analises (territorio_id)
    WHERE territorio_id IS NOT NULL;

-- ============================================================================
-- 3. VISÃO EXECUTIVA POR PAPEL
-- ============================================================================

CREATE TABLE visoes_executivas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    papel TEXT NOT NULL,
    secoes JSONB NOT NULL DEFAULT '[]',
    -- ex: [{"titulo":"Resumo financeiro","fonte":"receitas","tipo":"indicador"},
    --      {"titulo":"Tarefas urgentes","fonte":"tarefas","tipo":"lista","filtro":{"prioridade":"urgente"}}]

    atualizado_por UUID REFERENCES usuarios_internos(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (campanha_id, papel)
);

ALTER TABLE visoes_executivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE visoes_executivas FORCE ROW LEVEL SECURITY;

CREATE POLICY visoes_select ON visoes_executivas
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY visoes_write ON visoes_executivas
    FOR ALL USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'candidato')
    )
    WITH CHECK (campanha_id = current_campanha_id());

GRANT SELECT, INSERT, UPDATE ON visoes_executivas TO authenticated;

CREATE TRIGGER trg_audit_visoes_executivas
    AFTER INSERT OR UPDATE ON visoes_executivas
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
