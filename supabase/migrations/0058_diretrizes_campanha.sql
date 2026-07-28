-- Diretrizes da Campanha — fonte de verdade do discurso do candidato.
-- Toda geração de conteúdo por IA deve consultar estas diretrizes antes de produzir.
-- Posições por tema são separadas para permitir "Diretrizes sem Definição" por assunto.

CREATE TYPE status_diretriz AS ENUM ('rascunho', 'em_revisao', 'aprovada');
CREATE TYPE status_posicao AS ENUM ('definida', 'sem_definicao', 'em_revisao');

-- Uma por campanha: campos globais do discurso
CREATE TABLE diretrizes_campanha (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id) UNIQUE,
    versao INT NOT NULL DEFAULT 1,
    status status_diretriz NOT NULL DEFAULT 'rascunho',

    -- Identidade e trajetória
    identidade TEXT,

    -- Valores, causas e compromissos
    valores TEXT,

    -- Vocabulário e tom
    vocabulario_preferido TEXT[] NOT NULL DEFAULT '{}',
    vocabulario_proibido TEXT[] NOT NULL DEFAULT '{}',

    -- Assuntos sensíveis e limites
    assuntos_sensiveis TEXT[] NOT NULL DEFAULT '{}',
    limites TEXT,

    -- Mensagens-mãe: [{tema, mensagem, adaptacoes_permitidas}]
    mensagens_mae JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Aprovação
    aprovada_por UUID REFERENCES usuarios_internos(id),
    aprovada_em TIMESTAMPTZ,

    -- Autoria
    atualizada_por UUID REFERENCES usuarios_internos(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posições aprovadas por tema (vincula a temas_campanha ou tema livre)
CREATE TABLE diretrizes_posicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    tema_id UUID REFERENCES temas_campanha(id) ON DELETE SET NULL,
    tema_livre TEXT,
    posicao TEXT NOT NULL,
    evidencias TEXT,
    status status_posicao NOT NULL DEFAULT 'definida',
    atualizada_por UUID REFERENCES usuarios_internos(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tema_obrigatorio CHECK (tema_id IS NOT NULL OR tema_livre IS NOT NULL)
);

-- Histórico de versões (snapshot completo a cada aprovação)
CREATE TABLE diretrizes_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    versao INT NOT NULL,
    snapshot JSONB NOT NULL,
    alteracao TEXT,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diretrizes_campanha ON diretrizes_campanha (campanha_id);
CREATE INDEX idx_diretrizes_posicoes_campanha ON diretrizes_posicoes (campanha_id);
CREATE INDEX idx_diretrizes_posicoes_tema ON diretrizes_posicoes (tema_id);
CREATE INDEX idx_diretrizes_historico_campanha ON diretrizes_historico (campanha_id);

-- RLS
ALTER TABLE diretrizes_campanha ENABLE ROW LEVEL SECURITY;
ALTER TABLE diretrizes_campanha FORCE ROW LEVEL SECURITY;
ALTER TABLE diretrizes_posicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE diretrizes_posicoes FORCE ROW LEVEL SECURITY;
ALTER TABLE diretrizes_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE diretrizes_historico FORCE ROW LEVEL SECURITY;

-- Leitura: qualquer membro da campanha
CREATE POLICY diretrizes_campanha_select ON diretrizes_campanha
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY diretrizes_posicoes_select ON diretrizes_posicoes
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY diretrizes_historico_select ON diretrizes_historico
    FOR SELECT USING (campanha_id = current_campanha_id());

-- Edição: coord_campanha, candidato
CREATE POLICY diretrizes_campanha_insert ON diretrizes_campanha
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'candidato'));
CREATE POLICY diretrizes_campanha_update ON diretrizes_campanha
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'candidato'))
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY diretrizes_posicoes_insert ON diretrizes_posicoes
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'candidato'));
CREATE POLICY diretrizes_posicoes_update ON diretrizes_posicoes
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'candidato'))
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY diretrizes_posicoes_delete ON diretrizes_posicoes
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'candidato'));

-- Histórico: insert por coord/candidato, nunca update/delete (imutável)
CREATE POLICY diretrizes_historico_insert ON diretrizes_historico
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'candidato'));

GRANT SELECT, INSERT, UPDATE ON diretrizes_campanha TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON diretrizes_posicoes TO authenticated;
GRANT SELECT, INSERT ON diretrizes_historico TO authenticated;
