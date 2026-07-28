-- QuarantineRecord + ImportBatch
-- Dados nominais passam por quarentena antes de entrar no sistema.
-- Importações rastreáveis com proveniência.

CREATE TYPE status_quarentena AS ENUM ('pendente', 'aprovado', 'rejeitado', 'expirado');

CREATE TABLE lotes_importacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    descricao TEXT NOT NULL,
    origem TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'cidadaos',
    arquivo_nome TEXT,
    arquivo_path TEXT,
    total_registros INT NOT NULL DEFAULT 0,
    aprovados INT NOT NULL DEFAULT 0,
    rejeitados INT NOT NULL DEFAULT 0,
    pendentes INT NOT NULL DEFAULT 0,
    observacoes TEXT,

    importado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lotes_importacao_campanha ON lotes_importacao (campanha_id, created_at DESC);

ALTER TABLE lotes_importacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes_importacao FORCE ROW LEVEL SECURITY;

CREATE POLICY lotes_importacao_select ON lotes_importacao
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY lotes_importacao_insert ON lotes_importacao
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );

CREATE POLICY lotes_importacao_update ON lotes_importacao
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha'))
    WITH CHECK (campanha_id = current_campanha_id());

GRANT SELECT, INSERT, UPDATE ON lotes_importacao TO authenticated;

-- Quarentena de dados nominais
CREATE TABLE quarentena_registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    lote_id UUID REFERENCES lotes_importacao(id) ON DELETE CASCADE,

    dados JSONB NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'cidadao',
    status status_quarentena NOT NULL DEFAULT 'pendente',

    motivo_rejeicao TEXT,
    revisado_por UUID REFERENCES usuarios_internos(id),
    revisado_em TIMESTAMPTZ,

    entidade_destino_id UUID,
    entidade_destino_tabela TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quarentena_campanha ON quarentena_registros (campanha_id, status);
CREATE INDEX idx_quarentena_lote ON quarentena_registros (lote_id);

ALTER TABLE quarentena_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarentena_registros FORCE ROW LEVEL SECURITY;

CREATE POLICY quarentena_select ON quarentena_registros
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY quarentena_insert ON quarentena_registros
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );

CREATE POLICY quarentena_update ON quarentena_registros
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha'))
    WITH CHECK (campanha_id = current_campanha_id());

GRANT SELECT, INSERT, UPDATE ON quarentena_registros TO authenticated;

-- Auditoria
CREATE TRIGGER trg_audit_lotes_importacao
    AFTER INSERT OR UPDATE ON lotes_importacao
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trg_audit_quarentena
    AFTER INSERT OR UPDATE ON quarentena_registros
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
