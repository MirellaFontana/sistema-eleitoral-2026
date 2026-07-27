-- Planos de impulsionamento pagos (Meta Ads) gerados pela IA seguindo o método Pedro Sobral
-- adaptado ao contexto eleitoral brasileiro. Só o plano/tática — a execução no Ads Manager
-- e o tracking de resultados reais é responsabilidade da equipe.

CREATE TYPE objetivo_impulsionamento AS ENUM (
    'alcance', 'trafego', 'engajamento', 'video_views', 'conversao', 'mensagens', 'seguidores'
);

CREATE TABLE planos_impulsionamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    peca_conteudo_id UUID REFERENCES pecas_conteudo(id),   -- opcional: peça sendo impulsionada
    peca_descricao TEXT NOT NULL,                          -- descrição/copy da peça
    objetivo objetivo_impulsionamento NOT NULL,
    publico_prioritario TEXT NOT NULL,
    orcamento_total NUMERIC(10, 2) NOT NULL CHECK (orcamento_total > 0),
    prazo_dias INT NOT NULL CHECK (prazo_dias > 0),
    plano_json JSONB NOT NULL,
    modelo_ia TEXT,
    solicitado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_planos_impulsionamento_campanha
    ON planos_impulsionamento (campanha_id, created_at DESC);

ALTER TABLE planos_impulsionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_impulsionamento FORCE ROW LEVEL SECURITY;

-- Leitura: qualquer membro da campanha
CREATE POLICY planos_impulsionamento_select ON planos_impulsionamento
    FOR SELECT USING (campanha_id = current_campanha_id());

-- Criação: só quem produz marketing
CREATE POLICY planos_impulsionamento_insert ON planos_impulsionamento
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
        AND solicitado_por = auth.uid()
    );

-- Sem UPDATE nem DELETE — plano é registro imutável de decisão tática.

GRANT SELECT, INSERT ON planos_impulsionamento TO authenticated;
