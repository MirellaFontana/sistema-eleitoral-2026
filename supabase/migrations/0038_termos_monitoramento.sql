-- Cadastro do que a campanha quer monitorar — hoje a busca automática só procurava o nome do
-- próprio candidato (fixo no código). Pedido do usuário: poder cadastrar múltiplos alvos —
-- concorrentes, frases genéricas ("candidato ao governo do Paraná"), o que fizer sentido — e a
-- busca passa a rodar para todos os termos ativos, não só um.

CREATE TABLE termos_monitoramento (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    termo       TEXT NOT NULL,   -- texto exato da busca (nome, frase, o que for)
    rotulo      TEXT,            -- rótulo livre pra identificar o motivo (ex.: "Concorrente — Requião")
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por  UUID REFERENCES usuarios_internos(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_termos_monitoramento_campanha ON termos_monitoramento (campanha_id);

ALTER TABLE termos_monitoramento ENABLE ROW LEVEL SECURITY;
ALTER TABLE termos_monitoramento FORCE ROW LEVEL SECURITY;

-- Mesmo conjunto de papéis que já pode buscar/registrar item de monitoramento (migration 0007).
CREATE POLICY termos_monitoramento_select ON termos_monitoramento
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY termos_monitoramento_insert ON termos_monitoramento
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
    );

CREATE POLICY termos_monitoramento_update ON termos_monitoramento
    FOR UPDATE
    USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
    )
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY termos_monitoramento_delete ON termos_monitoramento
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON termos_monitoramento TO authenticated;
REVOKE ALL ON termos_monitoramento FROM anon;
