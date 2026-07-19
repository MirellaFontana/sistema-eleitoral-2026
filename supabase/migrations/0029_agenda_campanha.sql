-- Agenda de campanha — eventos territoriais (caminhada, reunião, comício, carreata,
-- entrevista, agenda interna) com vínculo de lideranças e presença.
-- (ref. specs.md [2026-07-19] "Agenda de campanha (eventos territoriais)")
--
-- Decisões de LGPD registradas na spec: nenhum vínculo nominal de eleitor/apoiador a
-- evento (presença de eleitor em ato de campanha é dado de opinião política que o
-- sistema não precisa guardar) — só lideranças já cadastradas + público estimado numérico.

CREATE TYPE tipo_evento_campanha AS ENUM
    ('caminhada', 'reuniao', 'comicio', 'carreata', 'entrevista', 'agenda_interna', 'outro');

CREATE TYPE status_evento_campanha AS ENUM
    ('planejado', 'confirmado', 'realizado', 'cancelado');

CREATE TABLE eventos_campanha (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id      UUID NOT NULL REFERENCES campanhas(id),
    titulo           TEXT NOT NULL,
    tipo             tipo_evento_campanha NOT NULL,
    status           status_evento_campanha NOT NULL DEFAULT 'planejado',
    data_inicio      TIMESTAMPTZ NOT NULL,
    data_fim         TIMESTAMPTZ,
    territorio_id    UUID REFERENCES territorios(id),
    local_texto      TEXT,
    descricao        TEXT,
    publico_estimado INTEGER CHECK (publico_estimado IS NULL OR publico_estimado >= 0),
    criado_por       UUID REFERENCES usuarios_internos(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fim_depois_do_inicio CHECK (data_fim IS NULL OR data_fim > data_inicio)
);

CREATE INDEX idx_eventos_campanha_data ON eventos_campanha (campanha_id, data_inicio);

CREATE TABLE eventos_liderancas (
    evento_id    UUID NOT NULL REFERENCES eventos_campanha(id) ON DELETE CASCADE,
    lideranca_id UUID NOT NULL REFERENCES liderancas(id) ON DELETE CASCADE,
    compareceu   BOOLEAN, -- NULL = presença ainda não marcada
    PRIMARY KEY (evento_id, lideranca_id)
);

ALTER TABLE eventos_campanha ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_campanha FORCE ROW LEVEL SECURITY;
ALTER TABLE eventos_liderancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_liderancas FORCE ROW LEVEL SECURITY;

-- Leitura: todos os papéis internos ativos da campanha (agenda é informação operacional
-- de todo mundo). Escrita: só coord_campanha — decisão registrada na spec; ampliar é
-- mudança de uma linha se o usuário pedir.
CREATE POLICY eventos_campanha_select ON eventos_campanha
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY eventos_campanha_insert ON eventos_campanha
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha'
    );
CREATE POLICY eventos_campanha_update ON eventos_campanha
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha')
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY eventos_campanha_delete ON eventos_campanha
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha');

-- Junção: o tenant é herdado do evento — toda policy passa pelo EXISTS no evento da
-- própria campanha (a policy de SELECT de eventos_campanha também se aplica dentro
-- do subselect, reforçando o isolamento).
CREATE POLICY eventos_liderancas_select ON eventos_liderancas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM eventos_campanha e
            WHERE e.id = evento_id AND e.campanha_id = current_campanha_id()
        )
    );
CREATE POLICY eventos_liderancas_insert ON eventos_liderancas
    FOR INSERT WITH CHECK (
        current_papel() = 'coord_campanha'
        AND EXISTS (
            SELECT 1 FROM eventos_campanha e
            WHERE e.id = evento_id AND e.campanha_id = current_campanha_id()
        )
    );
CREATE POLICY eventos_liderancas_update ON eventos_liderancas
    FOR UPDATE
    USING (
        current_papel() = 'coord_campanha'
        AND EXISTS (
            SELECT 1 FROM eventos_campanha e
            WHERE e.id = evento_id AND e.campanha_id = current_campanha_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM eventos_campanha e
            WHERE e.id = evento_id AND e.campanha_id = current_campanha_id()
        )
    );
CREATE POLICY eventos_liderancas_delete ON eventos_liderancas
    FOR DELETE USING (
        current_papel() = 'coord_campanha'
        AND EXISTS (
            SELECT 1 FROM eventos_campanha e
            WHERE e.id = evento_id AND e.campanha_id = current_campanha_id()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON eventos_campanha TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON eventos_liderancas TO authenticated;
REVOKE ALL ON eventos_campanha FROM anon;
REVOKE ALL ON eventos_liderancas FROM anon;
