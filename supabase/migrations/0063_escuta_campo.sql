-- Escuta estruturada de campo (FieldSignal)
-- Registro individual por evento/visita com: território, tema, perguntas/objeções,
-- reação ao discurso, discurso concorrente mencionado, frase representativa,
-- intensidade, contagem, encaminhamento.

CREATE TYPE intensidade_sinal AS ENUM ('forte', 'moderada', 'fraca');

CREATE TABLE sinais_campo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    -- Contexto
    territorio_id UUID REFERENCES territorios(id),
    evento_id UUID REFERENCES eventos_campanha(id),
    local_descricao TEXT,
    data_registro DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Tema e conteúdo
    tema TEXT,
    perguntas_objecoes TEXT[],
    reacao_discurso TEXT,
    discurso_concorrente TEXT,
    frase_representativa TEXT,
    intensidade intensidade_sinal NOT NULL DEFAULT 'moderada',
    contagem_pessoas INT DEFAULT 1,
    observacoes TEXT,

    -- Encaminhamento
    encaminhamento TEXT,
    encaminhado_para UUID REFERENCES usuarios_internos(id),
    encaminhado_em TIMESTAMPTZ,
    encaminhamento_status TEXT DEFAULT 'pendente',

    -- Metadados
    registrado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sinais_campo_campanha ON sinais_campo (campanha_id, created_at DESC);
CREATE INDEX idx_sinais_campo_territorio ON sinais_campo (territorio_id);
CREATE INDEX idx_sinais_campo_tema ON sinais_campo (campanha_id, tema);

ALTER TABLE sinais_campo ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinais_campo FORCE ROW LEVEL SECURITY;

CREATE POLICY sinais_campo_select ON sinais_campo
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY sinais_campo_insert ON sinais_campo
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND registrado_por = auth.uid()
    );

CREATE POLICY sinais_campo_update ON sinais_campo
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'candidato'))
    WITH CHECK (campanha_id = current_campanha_id());

GRANT SELECT, INSERT, UPDATE ON sinais_campo TO authenticated;

-- Trigger de auditoria
CREATE TRIGGER trg_audit_sinais_campo
    AFTER INSERT OR UPDATE ON sinais_campo
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
