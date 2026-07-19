-- Remodelagem do campo — lideranças sem login, metas, tarefas e suporte ao mapa
-- (ref. .pipeline/specs.md [2026-07-15] "Remodelagem do campo").
-- A liderança NÃO tem conta: é registro gerenciado. Quem digita os formulários que ela traz
-- é coord_campanha (preserva o modelo de PII da 0006 — marketing/jurídico seguem sem dado
-- nominal de cidadão).

-- 1. LIDERANÇAS
CREATE TABLE liderancas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    nome TEXT NOT NULL,
    telefone TEXT,
    cidade TEXT,
    bairro TEXT,
    territorio_id UUID REFERENCES territorios(id),
    status status_lideranca NOT NULL DEFAULT 'ativa',
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_liderancas_campanha ON liderancas (campanha_id);

-- 2. METAS (única fonte de verdade — inclusive a meta "da coluna" da tela de lideranças)
CREATE TABLE metas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    tipo tipo_meta NOT NULL,
    lideranca_id UUID REFERENCES liderancas(id) ON DELETE CASCADE,
    territorio_id UUID REFERENCES territorios(id) ON DELETE CASCADE,
    periodo periodo_meta NOT NULL DEFAULT 'total',
    alvo_cadastros INTEGER NOT NULL CHECK (alvo_cadastros > 0),
    alvo_apoiadores INTEGER CHECK (alvo_apoiadores IS NULL OR alvo_apoiadores > 0),
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT meta_lideranca_coerente CHECK (tipo <> 'lideranca' OR (lideranca_id IS NOT NULL AND territorio_id IS NULL)),
    CONSTRAINT meta_territorio_coerente CHECK (tipo <> 'territorio' OR (territorio_id IS NOT NULL AND lideranca_id IS NULL)),
    CONSTRAINT meta_geral_coerente CHECK (tipo <> 'geral' OR (lideranca_id IS NULL AND territorio_id IS NULL))
);
CREATE INDEX idx_metas_campanha ON metas (campanha_id);

-- 3. TAREFAS (responsável em texto livre — aceita nome de time ou de pessoa, decisão do usuário)
CREATE TABLE tarefas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    titulo TEXT NOT NULL,
    responsavel TEXT NOT NULL,
    status status_tarefa NOT NULL DEFAULT 'a_fazer',
    prazo DATE,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefas_campanha ON tarefas (campanha_id);

-- 4. CIDADÃOS: atribuição à liderança que trouxe o formulário
ALTER TABLE cidadaos ADD COLUMN lideranca_id UUID REFERENCES liderancas(id);
ALTER TABLE cidadaos ADD CONSTRAINT formulario_lideranca_exige_lideranca
    CHECK (origem_cadastro <> 'formulario_lideranca' OR lideranca_id IS NOT NULL);
CREATE INDEX idx_cidadaos_lideranca ON cidadaos (lideranca_id);

-- 5. TERRITÓRIOS: cidade + centro do círculo no mapa de cobertura.
-- Centro vem de busca bairro+cidade (Nominatim) ou lat/lng manual — nunca de dado pessoal.
ALTER TABLE territorios ADD COLUMN cidade TEXT;
ALTER TABLE territorios ADD COLUMN centro GEOGRAPHY(POINT, 4326);

-- 6. RLS
ALTER TABLE liderancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE liderancas FORCE ROW LEVEL SECURITY;
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas FORCE ROW LEVEL SECURITY;
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas FORCE ROW LEVEL SECURITY;

-- liderancas: leitura por todos os papéis internos (liderança é apoiador operacional da campanha,
-- não eleitor comum — decisão registrada na spec pro Revisor); gestão por coordenação+marketing.
-- Sem policy de DELETE: liderança sai de cena virando 'inativa', preservando a atribuição
-- histórica dos cadastros que trouxe.
CREATE POLICY liderancas_select ON liderancas
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY liderancas_insert ON liderancas
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );
CREATE POLICY liderancas_update ON liderancas
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'))
    WITH CHECK (campanha_id = current_campanha_id());

-- metas: leitura por todos; gestão (inclusive DELETE — a referência tem lixeira) por coordenação+marketing.
CREATE POLICY metas_select ON metas
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY metas_insert ON metas
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );
CREATE POLICY metas_update ON metas
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'))
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY metas_delete ON metas
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'));

-- tarefas: leitura por todos; criação/edição por toda a equipe operacional (candidato mantém
-- o "só leitura" já decidido na hierarquia; embaixador é papel legado, fora).
CREATE POLICY tarefas_select ON tarefas
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY tarefas_insert ON tarefas
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing', 'advogado_responsavel', 'assistente_juridico')
    );
CREATE POLICY tarefas_update ON tarefas
    FOR UPDATE
    USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing', 'advogado_responsavel', 'assistente_juridico')
    )
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY tarefas_delete ON tarefas
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha');

-- cidadaos: nova porta de entrada — digitação pela coordenação do formulário físico trazido
-- pela liderança. O EXISTS roda sob a RLS de liderancas, então só enxerga lideranças da própria
-- campanha — cross-tenant é rejeitado naturalmente.
CREATE POLICY cidadaos_insert_formulario ON cidadaos
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() = 'coord_campanha'
        AND origem_cadastro = 'formulario_lideranca'
        AND EXISTS (SELECT 1 FROM liderancas l WHERE l.id = lideranca_id)
    );

-- 7. GRANTS (lição da 0002: default privileges do Supabase dão tudo a anon — revogar explícito)
REVOKE ALL ON liderancas, metas, tarefas FROM anon;
REVOKE ALL ON liderancas, metas, tarefas FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON liderancas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON metas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tarefas TO authenticated;
