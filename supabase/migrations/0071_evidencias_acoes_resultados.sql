-- Entidades normalizadas do ciclo de inteligência:
-- Evidence (evidencias_decisao), Action (acoes_decisao), Outcome (resultados_decisao)
-- Complementam a tabela decisoes, que mantém campos inline para conveniência.

-- ─── Evidências ─────────────────────────────────────────────────────────────
CREATE TABLE evidencias_decisao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decisao_id UUID NOT NULL REFERENCES decisoes(id) ON DELETE CASCADE,
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    tipo TEXT NOT NULL, -- recomendacao, sinal_campo, sinal_concorrente, monitoramento, normativa, campo_livre
    referencia_id UUID,
    titulo TEXT NOT NULL,
    descricao TEXT,
    dados JSONB DEFAULT '{}',

    registrado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidencias_decisao ON evidencias_decisao(decisao_id);

ALTER TABLE evidencias_decisao ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias_decisao FORCE ROW LEVEL SECURITY;

CREATE POLICY evidencias_select ON evidencias_decisao
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY evidencias_insert ON evidencias_decisao
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND registrado_por = auth.uid()
    );

GRANT SELECT, INSERT ON evidencias_decisao TO authenticated;

CREATE TRIGGER trg_audit_evidencias_decisao
    AFTER INSERT ON evidencias_decisao
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- ─── Ações ──────────────────────────────────────────────────────────────────
CREATE TYPE status_acao AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');

CREATE TABLE acoes_decisao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decisao_id UUID NOT NULL REFERENCES decisoes(id) ON DELETE CASCADE,
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    descricao TEXT NOT NULL,
    responsavel_id UUID REFERENCES usuarios_internos(id),
    prazo DATE,
    status status_acao NOT NULL DEFAULT 'pendente',
    observacoes TEXT,

    registrado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_acoes_decisao ON acoes_decisao(decisao_id);
CREATE INDEX idx_acoes_status ON acoes_decisao(campanha_id, status);

ALTER TABLE acoes_decisao ENABLE ROW LEVEL SECURITY;
ALTER TABLE acoes_decisao FORCE ROW LEVEL SECURITY;

CREATE POLICY acoes_select ON acoes_decisao
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY acoes_insert ON acoes_decisao
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND registrado_por = auth.uid()
    );

CREATE POLICY acoes_update ON acoes_decisao
    FOR UPDATE USING (
        campanha_id = current_campanha_id()
        AND (current_papel() IN ('coord_campanha', 'candidato')
             OR responsavel_id = auth.uid()
             OR registrado_por = auth.uid())
    );

GRANT SELECT, INSERT, UPDATE ON acoes_decisao TO authenticated;

CREATE TRIGGER trg_audit_acoes_decisao
    AFTER INSERT OR UPDATE ON acoes_decisao
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- ─── Resultados (Outcomes) ──────────────────────────────────────────────────
CREATE TABLE resultados_decisao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decisao_id UUID NOT NULL REFERENCES decisoes(id) ON DELETE CASCADE,
    acao_id UUID REFERENCES acoes_decisao(id),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    descricao TEXT NOT NULL,
    avaliacao TEXT CHECK (avaliacao IN ('sucesso', 'parcial', 'falha', 'inconclusivo')),
    indicadores JSONB DEFAULT '{}',
    aprendizado TEXT,

    registrado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resultados_decisao ON resultados_decisao(decisao_id);

ALTER TABLE resultados_decisao ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_decisao FORCE ROW LEVEL SECURITY;

CREATE POLICY resultados_select ON resultados_decisao
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY resultados_insert ON resultados_decisao
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND registrado_por = auth.uid()
    );

GRANT SELECT, INSERT ON resultados_decisao TO authenticated;

CREATE TRIGGER trg_audit_resultados_decisao
    AFTER INSERT ON resultados_decisao
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
