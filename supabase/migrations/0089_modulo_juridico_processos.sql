-- Módulo Jurídico: processos eleitorais, prazos processuais e vínculo de provas
-- Reutiliza monitoramento_itens (hash+captura) como base de evidências

CREATE TYPE tipo_processo AS ENUM (
    'representacao', 'aije', 'aime', 'recurso', 'notificacao', 'outro'
);

CREATE TYPE status_processo AS ENUM (
    'em_elaboracao', 'protocolado', 'em_andamento', 'aguardando_julgamento', 'julgado', 'arquivado'
);

CREATE TYPE status_prazo_processual AS ENUM ('pendente', 'cumprido', 'perdido');

-- 1. Processos eleitorais
CREATE TABLE processos_eleitorais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    numero_processo TEXT,
    tipo tipo_processo NOT NULL DEFAULT 'representacao',
    tribunal TEXT NOT NULL DEFAULT 'TRE-PR',
    status status_processo NOT NULL DEFAULT 'em_elaboracao',

    titulo TEXT NOT NULL,
    descricao TEXT,
    parte_autora TEXT,
    parte_re TEXT,

    data_distribuicao DATE,
    data_julgamento DATE,
    resultado TEXT,

    registrado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_processos_campanha ON processos_eleitorais (campanha_id, status);

ALTER TABLE processos_eleitorais ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos_eleitorais FORCE ROW LEVEL SECURITY;

CREATE POLICY processos_select ON processos_eleitorais
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY processos_insert ON processos_eleitorais
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('advogado_responsavel', 'assistente_juridico', 'coord_campanha')
    );

CREATE POLICY processos_update ON processos_eleitorais
    FOR UPDATE USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('advogado_responsavel', 'assistente_juridico', 'coord_campanha')
    );

CREATE POLICY processos_delete ON processos_eleitorais
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('advogado_responsavel', 'coord_campanha')
    );

-- 2. Prazos processuais (por processo)
CREATE TABLE prazos_processuais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processos_eleitorais(id) ON DELETE CASCADE,
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    titulo TEXT NOT NULL,
    data_limite DATE NOT NULL,
    status status_prazo_processual NOT NULL DEFAULT 'pendente',
    descricao TEXT,

    criado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prazos_processuais_processo ON prazos_processuais (processo_id);
CREATE INDEX idx_prazos_processuais_campanha ON prazos_processuais (campanha_id, data_limite);

ALTER TABLE prazos_processuais ENABLE ROW LEVEL SECURITY;
ALTER TABLE prazos_processuais FORCE ROW LEVEL SECURITY;

CREATE POLICY prazos_proc_select ON prazos_processuais
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY prazos_proc_insert ON prazos_processuais
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('advogado_responsavel', 'assistente_juridico', 'coord_campanha')
    );

CREATE POLICY prazos_proc_update ON prazos_processuais
    FOR UPDATE USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('advogado_responsavel', 'assistente_juridico', 'coord_campanha')
    );

CREATE POLICY prazos_proc_delete ON prazos_processuais
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('advogado_responsavel', 'coord_campanha')
    );

-- 3. Vínculo de provas (monitoramento_itens) a processos
CREATE TABLE provas_processo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processos_eleitorais(id) ON DELETE CASCADE,
    monitoramento_item_id UUID NOT NULL REFERENCES monitoramento_itens(id),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    observacao TEXT,
    anexado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (processo_id, monitoramento_item_id)
);

CREATE INDEX idx_provas_processo ON provas_processo (processo_id);

ALTER TABLE provas_processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE provas_processo FORCE ROW LEVEL SECURITY;

CREATE POLICY provas_proc_select ON provas_processo
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY provas_proc_insert ON provas_processo
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('advogado_responsavel', 'assistente_juridico', 'coord_campanha')
    );

CREATE POLICY provas_proc_delete ON provas_processo
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('advogado_responsavel', 'coord_campanha')
    );

-- Auditoria
CREATE TRIGGER trg_audit_processos
    AFTER INSERT OR UPDATE ON processos_eleitorais
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trg_audit_prazos_processuais
    AFTER INSERT OR UPDATE ON prazos_processuais
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trg_audit_provas_processo
    AFTER INSERT OR UPDATE ON provas_processo
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
