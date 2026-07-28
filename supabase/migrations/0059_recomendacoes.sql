-- Recomendações explicáveis — ciclo completo:
-- evidência → recomendação → decisão → ação → resultado → aprendizagem
-- Cada recomendação registra fatos, regras, fontes, confiança e limitações.

CREATE TYPE status_recomendacao AS ENUM (
    'rascunho',
    'aguardando_revisao',
    'aprovada',
    'rejeitada',
    'convertida_acao',
    'concluida',
    'resultado_avaliado',
    'arquivada'
);

CREATE TYPE grau_confianca AS ENUM ('alta', 'media', 'baixa');
CREATE TYPE grau_urgencia AS ENUM ('critica', 'alta', 'media', 'baixa');

CREATE TABLE recomendacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    -- Conteúdo da recomendação
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'geral',
    urgencia grau_urgencia NOT NULL DEFAULT 'media',

    -- Explicabilidade (por que estou vendo isto?)
    fatos_utilizados TEXT,
    regras_aplicadas TEXT,
    fontes TEXT,
    confianca grau_confianca NOT NULL DEFAULT 'media',
    limitacoes TEXT,

    -- Status workflow
    status status_recomendacao NOT NULL DEFAULT 'aguardando_revisao',

    -- Decisão humana
    decisao_texto TEXT,
    decidido_por UUID REFERENCES usuarios_internos(id),
    decidido_em TIMESTAMPTZ,

    -- Ação derivada
    acao_titulo TEXT,
    acao_responsavel UUID REFERENCES usuarios_internos(id),
    acao_prazo DATE,
    acao_descricao TEXT,

    -- Resultado observado
    resultado_texto TEXT,
    resultado_registrado_por UUID REFERENCES usuarios_internos(id),
    resultado_registrado_em TIMESTAMPTZ,

    -- Aprendizagem
    aprendizagem TEXT,
    avaliacao_qualidade INT CHECK (avaliacao_qualidade BETWEEN 1 AND 5),

    -- Metadados
    gerada_por_ia BOOLEAN NOT NULL DEFAULT true,
    provedor_ia TEXT,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recomendacoes_campanha ON recomendacoes (campanha_id);
CREATE INDEX idx_recomendacoes_status ON recomendacoes (campanha_id, status);

ALTER TABLE recomendacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recomendacoes FORCE ROW LEVEL SECURITY;

-- Leitura: qualquer membro
CREATE POLICY recomendacoes_select ON recomendacoes
    FOR SELECT USING (campanha_id = current_campanha_id());

-- Insert: coord_campanha, candidato (humano ou via IA)
CREATE POLICY recomendacoes_insert ON recomendacoes
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'candidato', 'coord_marketing', 'advogado_responsavel')
    );

-- Update: coord_campanha, candidato (aprovar/rejeitar/registrar resultado)
CREATE POLICY recomendacoes_update ON recomendacoes
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'candidato'))
    WITH CHECK (campanha_id = current_campanha_id());

GRANT SELECT, INSERT, UPDATE ON recomendacoes TO authenticated;
