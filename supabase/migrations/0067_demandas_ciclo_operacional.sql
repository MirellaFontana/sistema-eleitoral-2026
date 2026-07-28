-- Evolui demandas_observadas de simples observação para ciclo operacional
-- com status, prioridade, responsável e encaminhamento.

CREATE TYPE status_demanda AS ENUM ('registrada', 'em_analise', 'encaminhada', 'em_andamento', 'resolvida', 'descartada');
CREATE TYPE prioridade_demanda AS ENUM ('critica', 'alta', 'media', 'baixa');

ALTER TABLE demandas_observadas
    ADD COLUMN status status_demanda NOT NULL DEFAULT 'registrada',
    ADD COLUMN prioridade prioridade_demanda NOT NULL DEFAULT 'media',
    ADD COLUMN responsavel_id UUID REFERENCES usuarios_internos(id),
    ADD COLUMN encaminhamento TEXT,
    ADD COLUMN resposta TEXT,
    ADD COLUMN resolvida_em TIMESTAMPTZ,
    ADD COLUMN origem TEXT DEFAULT 'observacao',
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX idx_demandas_status ON demandas_observadas (campanha_id, status);

-- Auditoria
CREATE TRIGGER trg_audit_demandas_observadas
    AFTER INSERT OR UPDATE ON demandas_observadas
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
