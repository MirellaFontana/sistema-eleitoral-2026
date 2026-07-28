-- Base Normativa Eleitoral estruturada
-- NormativeSource (fontes normativas) + NormativeProvision (dispositivos)
-- Cada norma: autoridade, eleição/ciclo, título, artigos, vigência, URL oficial,
-- data de verificação e hash do conteúdo.
-- Estado de validação: pendente → validada → desatualizada → revogada

CREATE TYPE status_validacao_normativa AS ENUM (
    'pendente',
    'validada',
    'desatualizada',
    'revogada'
);

CREATE TYPE autoridade_normativa AS ENUM (
    'tse',
    'congresso_nacional',
    'presidencia',
    'stf',
    'tre',
    'anpd',
    'outra'
);

-- Fontes normativas (Lei, Resolução, Constituição, etc.)
CREATE TABLE fontes_normativas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    autoridade autoridade_normativa NOT NULL DEFAULT 'tse',
    tipo TEXT NOT NULL,
    numero TEXT,
    ano INT,
    titulo TEXT NOT NULL,
    ementa TEXT,
    eleicao_ciclo TEXT,
    url_oficial TEXT,
    data_publicacao DATE,
    data_verificacao DATE,
    hash_conteudo TEXT,
    status status_validacao_normativa NOT NULL DEFAULT 'pendente',
    validado_por UUID REFERENCES usuarios_internos(id),
    validado_em TIMESTAMPTZ,
    observacoes TEXT,

    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fontes_normativas_campanha ON fontes_normativas (campanha_id);
CREATE INDEX idx_fontes_normativas_tipo ON fontes_normativas (campanha_id, tipo);
CREATE INDEX idx_fontes_normativas_status ON fontes_normativas (campanha_id, status);

-- Dispositivos (artigo, parágrafo, inciso) de cada fonte
CREATE TABLE dispositivos_normativos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    fonte_id UUID NOT NULL REFERENCES fontes_normativas(id) ON DELETE CASCADE,

    artigo TEXT,
    paragrafo TEXT,
    inciso TEXT,
    alinea TEXT,
    texto TEXT NOT NULL,
    tema TEXT,
    cargo TEXT,
    etapa TEXT,
    vigencia_inicio DATE,
    vigencia_fim DATE,
    alterado_por TEXT,
    status status_validacao_normativa NOT NULL DEFAULT 'pendente',
    observacoes TEXT,

    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispositivos_fonte ON dispositivos_normativos (fonte_id);
CREATE INDEX idx_dispositivos_campanha ON dispositivos_normativos (campanha_id);
CREATE INDEX idx_dispositivos_tema ON dispositivos_normativos (campanha_id, tema);
CREATE INDEX idx_dispositivos_artigo ON dispositivos_normativos (fonte_id, artigo);

-- RLS
ALTER TABLE fontes_normativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fontes_normativas FORCE ROW LEVEL SECURITY;
ALTER TABLE dispositivos_normativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos_normativos FORCE ROW LEVEL SECURITY;

-- Leitura: qualquer membro
CREATE POLICY fontes_normativas_select ON fontes_normativas
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY dispositivos_normativos_select ON dispositivos_normativos
    FOR SELECT USING (campanha_id = current_campanha_id());

-- Escrita: coord_campanha, advogado_responsavel, assistente_juridico
CREATE POLICY fontes_normativas_insert ON fontes_normativas
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico')
    );

CREATE POLICY fontes_normativas_update ON fontes_normativas
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico'))
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY dispositivos_normativos_insert ON dispositivos_normativos
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico')
    );

CREATE POLICY dispositivos_normativos_update ON dispositivos_normativos
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico'))
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY dispositivos_normativos_delete ON dispositivos_normativos
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel')
    );

GRANT SELECT, INSERT, UPDATE ON fontes_normativas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dispositivos_normativos TO authenticated;
