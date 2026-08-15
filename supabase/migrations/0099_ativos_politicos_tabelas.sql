-- Ativos Políticos — tabelas, RLS, auditoria, GIS, seed de categorias.
-- Camada transversal da rede de poder político territorial.

-- ============================================================================
-- 1. TABELAS DE TAXONOMIA (editáveis pelo administrador)
-- ============================================================================

CREATE TABLE categorias_ativo_politico (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    nome        TEXT NOT NULL,
    grupo       TEXT NOT NULL,
    cor         TEXT,
    icone       TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    ordem       INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campanha_id, nome)
);
CREATE INDEX idx_categorias_ativo_campanha ON categorias_ativo_politico (campanha_id);

CREATE TABLE tipos_relacionamento_ativo (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    nome        TEXT NOT NULL,
    direcional  BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campanha_id, nome)
);
CREATE INDEX idx_tipos_rel_ativo_campanha ON tipos_relacionamento_ativo (campanha_id);

-- ============================================================================
-- 2. TABELA PRINCIPAL
-- ============================================================================

CREATE TABLE ativos_politicos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id     UUID NOT NULL REFERENCES campanhas(id),

    -- Identificação
    nome            TEXT NOT NULL,
    nome_social     TEXT,
    foto_url        TEXT,
    telefone        TEXT,
    whatsapp        TEXT,
    email           TEXT,
    cidade          TEXT,
    estado          CHAR(2),
    endereco        TEXT,
    bairro          TEXT,
    geolocalizacao  GEOGRAPHY(POINT, 4326),

    -- Classificação
    categoria_id    UUID NOT NULL REFERENCES categorias_ativo_politico(id),
    subtipo         TEXT,
    cargo_atual     TEXT,
    cargo_anterior  TEXT,
    partido         TEXT,
    entidade        TEXT,
    setor           TEXT,
    territorio_id   UUID REFERENCES territorios(id),

    -- Influência
    nivel_influencia        nivel_influencia_ativo NOT NULL DEFAULT 'nao_avaliado',
    abrangencia             abrangencia_ativo NOT NULL DEFAULT 'municipal',
    relevancia_estrategica  SMALLINT CHECK (relevancia_estrategica BETWEEN 1 AND 5),
    capacidade_mobilizacao  SMALLINT CHECK (capacidade_mobilizacao BETWEEN 1 AND 5),
    pessoas_alcancadas_est  INTEGER CHECK (pessoas_alcancadas_est >= 0),

    -- Relacionamento com a campanha
    status_campanha status_relacionamento_ativo NOT NULL DEFAULT 'identificado',

    -- Metadata
    observacoes     TEXT,
    criado_por      UUID REFERENCES usuarios_internos(id),
    atualizado_por  UUID REFERENCES usuarios_internos(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ativos_campanha ON ativos_politicos (campanha_id);
CREATE INDEX idx_ativos_categoria ON ativos_politicos (categoria_id);
CREATE INDEX idx_ativos_territorio ON ativos_politicos (territorio_id);
CREATE INDEX idx_ativos_cidade ON ativos_politicos (cidade);
CREATE INDEX idx_ativos_partido ON ativos_politicos (partido);
CREATE INDEX idx_ativos_nivel ON ativos_politicos (nivel_influencia);
CREATE INDEX idx_ativos_status ON ativos_politicos (status_campanha);
CREATE INDEX idx_ativos_geo ON ativos_politicos USING gist (geolocalizacao);

-- updated_at automático
CREATE OR REPLACE FUNCTION atualizar_updated_at_ativos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ativos_updated_at
    BEFORE UPDATE ON ativos_politicos
    FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at_ativos();

-- ============================================================================
-- 3. RELACIONAMENTOS ENTRE ATIVOS (grafo)
-- ============================================================================

CREATE TABLE relacionamentos_ativos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id      UUID NOT NULL REFERENCES campanhas(id),
    ativo_origem_id  UUID NOT NULL REFERENCES ativos_politicos(id) ON DELETE CASCADE,
    ativo_destino_id UUID NOT NULL REFERENCES ativos_politicos(id) ON DELETE CASCADE,
    tipo_id          UUID NOT NULL REFERENCES tipos_relacionamento_ativo(id),
    observacoes      TEXT,
    criado_por       UUID REFERENCES usuarios_internos(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ativo_origem_id <> ativo_destino_id)
);

CREATE INDEX idx_rel_ativos_campanha ON relacionamentos_ativos (campanha_id);
CREATE INDEX idx_rel_ativos_origem ON relacionamentos_ativos (ativo_origem_id);
CREATE INDEX idx_rel_ativos_destino ON relacionamentos_ativos (ativo_destino_id);

-- ============================================================================
-- 4. HISTÓRICO DE INTERAÇÕES
-- ============================================================================

CREATE TABLE historico_ativos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id     UUID NOT NULL REFERENCES campanhas(id),
    ativo_id        UUID NOT NULL REFERENCES ativos_politicos(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL,
    titulo          TEXT NOT NULL,
    descricao       TEXT,
    data_ocorrencia TIMESTAMPTZ NOT NULL DEFAULT now(),
    evento_id       UUID REFERENCES eventos_campanha(id),
    criado_por      UUID REFERENCES usuarios_internos(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hist_ativos_campanha ON historico_ativos (campanha_id);
CREATE INDEX idx_hist_ativos_ativo ON historico_ativos (ativo_id);

-- ============================================================================
-- 5. VÍNCULO ATIVOS ↔ EVENTOS
-- ============================================================================

CREATE TABLE eventos_ativos (
    evento_id   UUID NOT NULL REFERENCES eventos_campanha(id) ON DELETE CASCADE,
    ativo_id    UUID NOT NULL REFERENCES ativos_politicos(id) ON DELETE CASCADE,
    compareceu  BOOLEAN,
    observacoes TEXT,
    PRIMARY KEY (evento_id, ativo_id)
);

-- ============================================================================
-- 6. RLS
-- ============================================================================

ALTER TABLE categorias_ativo_politico ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_ativo_politico FORCE ROW LEVEL SECURITY;
ALTER TABLE tipos_relacionamento_ativo ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_relacionamento_ativo FORCE ROW LEVEL SECURITY;
ALTER TABLE ativos_politicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ativos_politicos FORCE ROW LEVEL SECURITY;
ALTER TABLE relacionamentos_ativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE relacionamentos_ativos FORCE ROW LEVEL SECURITY;
ALTER TABLE historico_ativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_ativos FORCE ROW LEVEL SECURITY;
ALTER TABLE eventos_ativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_ativos FORCE ROW LEVEL SECURITY;

-- categorias: leitura por todos, gestão por quem tem permissão
CREATE POLICY cat_ativo_select ON categorias_ativo_politico
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY cat_ativo_insert ON categorias_ativo_politico
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'));
CREATE POLICY cat_ativo_update ON categorias_ativo_politico
    FOR UPDATE USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'))
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY cat_ativo_delete ON categorias_ativo_politico
    FOR DELETE USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'));

-- tipos_relacionamento: mesma lógica
CREATE POLICY tipo_rel_select ON tipos_relacionamento_ativo
    FOR SELECT USING (campanha_id = current_campanha_id());
CREATE POLICY tipo_rel_insert ON tipos_relacionamento_ativo
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'));
CREATE POLICY tipo_rel_update ON tipos_relacionamento_ativo
    FOR UPDATE USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'))
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY tipo_rel_delete ON tipos_relacionamento_ativo
    FOR DELETE USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'));

-- ativos_politicos: leitura por quem tem ver_ativos_politicos, gestão por gerenciar_ativos_politicos
CREATE POLICY ativos_select ON ativos_politicos
    FOR SELECT USING (campanha_id = current_campanha_id() AND has_permission('ver_ativos_politicos'));
CREATE POLICY ativos_insert ON ativos_politicos
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'));
CREATE POLICY ativos_update ON ativos_politicos
    FOR UPDATE USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'))
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY ativos_delete ON ativos_politicos
    FOR DELETE USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'));

-- relacionamentos_ativos
CREATE POLICY rel_ativos_select ON relacionamentos_ativos
    FOR SELECT USING (campanha_id = current_campanha_id() AND has_permission('ver_ativos_politicos'));
CREATE POLICY rel_ativos_insert ON relacionamentos_ativos
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'));
CREATE POLICY rel_ativos_update ON relacionamentos_ativos
    FOR UPDATE USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'))
    WITH CHECK (campanha_id = current_campanha_id());
CREATE POLICY rel_ativos_delete ON relacionamentos_ativos
    FOR DELETE USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'));

-- historico_ativos
CREATE POLICY hist_ativos_select ON historico_ativos
    FOR SELECT USING (campanha_id = current_campanha_id() AND has_permission('ver_ativos_politicos'));
CREATE POLICY hist_ativos_insert ON historico_ativos
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND has_permission('gerenciar_ativos_politicos'));

-- eventos_ativos (via join com eventos_campanha)
CREATE POLICY ev_ativos_select ON eventos_ativos
    FOR SELECT USING (
        has_permission('ver_ativos_politicos')
        AND EXISTS (SELECT 1 FROM eventos_campanha e WHERE e.id = eventos_ativos.evento_id AND e.campanha_id = current_campanha_id())
    );
CREATE POLICY ev_ativos_insert ON eventos_ativos
    FOR INSERT WITH CHECK (
        has_permission('gerenciar_ativos_politicos')
        AND EXISTS (SELECT 1 FROM eventos_campanha e WHERE e.id = eventos_ativos.evento_id AND e.campanha_id = current_campanha_id())
    );
CREATE POLICY ev_ativos_update ON eventos_ativos
    FOR UPDATE USING (
        has_permission('gerenciar_ativos_politicos')
        AND EXISTS (SELECT 1 FROM eventos_campanha e WHERE e.id = eventos_ativos.evento_id AND e.campanha_id = current_campanha_id())
    );
CREATE POLICY ev_ativos_delete ON eventos_ativos
    FOR DELETE USING (
        has_permission('gerenciar_ativos_politicos')
        AND EXISTS (SELECT 1 FROM eventos_campanha e WHERE e.id = eventos_ativos.evento_id AND e.campanha_id = current_campanha_id())
    );

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

REVOKE ALL ON categorias_ativo_politico, tipos_relacionamento_ativo,
    ativos_politicos, relacionamentos_ativos, historico_ativos, eventos_ativos
    FROM anon;
REVOKE ALL ON categorias_ativo_politico, tipos_relacionamento_ativo,
    ativos_politicos, relacionamentos_ativos, historico_ativos, eventos_ativos
    FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON categorias_ativo_politico TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tipos_relacionamento_ativo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ativos_politicos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON relacionamentos_ativos TO authenticated;
GRANT SELECT, INSERT ON historico_ativos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON eventos_ativos TO authenticated;

-- ============================================================================
-- 8. AUDITORIA
-- ============================================================================

CREATE TRIGGER trg_audit_ativos_politicos
    AFTER INSERT OR UPDATE OR DELETE ON ativos_politicos
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trg_audit_relacionamentos_ativos
    AFTER INSERT OR UPDATE OR DELETE ON relacionamentos_ativos
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- ============================================================================
-- 9. FUNÇÃO GIS — camada do mapa
-- ============================================================================

CREATE OR REPLACE FUNCTION mapa_ativos_politicos()
RETURNS TABLE(lat FLOAT8, lng FLOAT8, nome TEXT, categoria TEXT, nivel TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT
        COALESCE(
            ST_Y(a.geolocalizacao::geometry),
            ST_Y(t.centro::geometry) + (random() - 0.5) * 0.006
        ),
        COALESCE(
            ST_X(a.geolocalizacao::geometry),
            ST_X(t.centro::geometry) + (random() - 0.5) * 0.006
        ),
        a.nome,
        c.nome,
        a.nivel_influencia::TEXT
    FROM ativos_politicos a
    LEFT JOIN territorios t ON t.id = a.territorio_id
    LEFT JOIN categorias_ativo_politico c ON c.id = a.categoria_id
    WHERE a.campanha_id = current_campanha_id()
      AND (a.geolocalizacao IS NOT NULL OR t.centro IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION mapa_ativos_politicos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mapa_ativos_politicos() TO authenticated;

-- ============================================================================
-- 10. PERMISSÕES NAS FUNÇÕES PADRÃO + SEED DE CATEGORIAS
-- ============================================================================

-- Adicionar novas permissões às funções padrão existentes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT fc.id AS funcao_id, fc.nome
        FROM funcoes_campanha fc
        WHERE fc.sistema = true
          AND fc.nome IN ('Coordenador de campanha', 'Coordenador de marketing', 'Candidato')
    LOOP
        IF r.nome = 'Candidato' THEN
            INSERT INTO funcao_permissoes (funcao_id, permissao) VALUES
                (r.funcao_id, 'ver_ativos_politicos')
            ON CONFLICT DO NOTHING;
        ELSE
            INSERT INTO funcao_permissoes (funcao_id, permissao) VALUES
                (r.funcao_id, 'ver_ativos_politicos'),
                (r.funcao_id, 'gerenciar_ativos_politicos')
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END;
$$;

-- Atualizar criar_funcoes_padrao para incluir as novas permissões em campanhas futuras
CREATE OR REPLACE FUNCTION criar_funcoes_padrao(p_campanha_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_funcao_id UUID;
BEGIN
    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Coordenador de campanha', 'Acesso total — todas as permissões delegáveis', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING
    RETURNING id INTO v_funcao_id;
    IF v_funcao_id IS NOT NULL THEN
        INSERT INTO funcao_permissoes (funcao_id, permissao)
        SELECT v_funcao_id, p.permissao
        FROM unnest(enum_range(NULL::permissao_sistema)) AS p(permissao)
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Candidato', 'Visão executiva — vê dados agregados e nominais, sem edição', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING
    RETURNING id INTO v_funcao_id;
    IF v_funcao_id IS NOT NULL THEN
        INSERT INTO funcao_permissoes (funcao_id, permissao) VALUES
            (v_funcao_id, 'ver_eleitores'),
            (v_funcao_id, 'ver_apoiadores'),
            (v_funcao_id, 'ver_liderancas'),
            (v_funcao_id, 'ver_auditoria'),
            (v_funcao_id, 'ver_ativos_politicos')
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Advogado responsável', 'Bloco jurídico — monitoramento, peças, auditoria', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING
    RETURNING id INTO v_funcao_id;
    IF v_funcao_id IS NOT NULL THEN
        INSERT INTO funcao_permissoes (funcao_id, permissao) VALUES
            (v_funcao_id, 'registrar_monitoramento'),
            (v_funcao_id, 'ver_auditoria'),
            (v_funcao_id, 'gerenciar_pecas'),
            (v_funcao_id, 'aprovar_pecas'),
            (v_funcao_id, 'gerenciar_tarefas'),
            (v_funcao_id, 'publicar_avisos')
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Assistente jurídico', 'Apoio ao advogado — mesmas permissões, sem encaminhamento à JE', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING
    RETURNING id INTO v_funcao_id;
    IF v_funcao_id IS NOT NULL THEN
        INSERT INTO funcao_permissoes (funcao_id, permissao) VALUES
            (v_funcao_id, 'registrar_monitoramento'),
            (v_funcao_id, 'ver_auditoria'),
            (v_funcao_id, 'gerenciar_pecas'),
            (v_funcao_id, 'aprovar_pecas'),
            (v_funcao_id, 'gerenciar_tarefas'),
            (v_funcao_id, 'publicar_avisos')
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Coordenador de marketing', 'Gestão de conteúdo, comunicação e cadastros operacionais', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING
    RETURNING id INTO v_funcao_id;
    IF v_funcao_id IS NOT NULL THEN
        INSERT INTO funcao_permissoes (funcao_id, permissao) VALUES
            (v_funcao_id, 'ver_apoiadores'),
            (v_funcao_id, 'gerenciar_apoiadores'),
            (v_funcao_id, 'ver_liderancas'),
            (v_funcao_id, 'gerenciar_liderancas'),
            (v_funcao_id, 'enviar_mensagens'),
            (v_funcao_id, 'gerenciar_modelos'),
            (v_funcao_id, 'aprovar_modelos'),
            (v_funcao_id, 'publicar_avisos'),
            (v_funcao_id, 'gerenciar_pecas'),
            (v_funcao_id, 'aprovar_pecas'),
            (v_funcao_id, 'usar_ia'),
            (v_funcao_id, 'gerenciar_concorrentes'),
            (v_funcao_id, 'gerenciar_demandas'),
            (v_funcao_id, 'gerenciar_tarefas'),
            (v_funcao_id, 'gerenciar_base_conhecimento'),
            (v_funcao_id, 'registrar_monitoramento'),
            (v_funcao_id, 'ver_ativos_politicos'),
            (v_funcao_id, 'gerenciar_ativos_politicos')
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Redator de marketing', 'Criação de conteúdo e uso de IA', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING
    RETURNING id INTO v_funcao_id;
    IF v_funcao_id IS NOT NULL THEN
        INSERT INTO funcao_permissoes (funcao_id, permissao) VALUES
            (v_funcao_id, 'gerenciar_modelos'),
            (v_funcao_id, 'publicar_avisos'),
            (v_funcao_id, 'gerenciar_pecas'),
            (v_funcao_id, 'usar_ia'),
            (v_funcao_id, 'gerenciar_tarefas')
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Embaixador', 'Campo — ver e cadastrar eleitores no próprio território', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING
    RETURNING id INTO v_funcao_id;
    IF v_funcao_id IS NOT NULL THEN
        INSERT INTO funcao_permissoes (funcao_id, permissao) VALUES
            (v_funcao_id, 'ver_eleitores'),
            (v_funcao_id, 'cadastrar_eleitores')
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Apoio marketing', 'Sem permissões padrão — o coordenador customiza', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING;

    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Apoio campanha', 'Sem permissões padrão — o coordenador customiza', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING;

    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Apoio coordenação', 'Sem permissões padrão — o coordenador customiza', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING;
END;
$$;

-- Atualizar fallback de has_permission para incluir as novas permissões
CREATE OR REPLACE FUNCTION has_permission(p permissao_sistema)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_papel   papel_usuario;
    v_funcao  UUID;
    v_status  status_usuario_interno;
BEGIN
    SELECT papel, funcao_id, status
    INTO v_papel, v_funcao, v_status
    FROM usuarios_internos
    WHERE id = auth.uid();

    IF v_papel IS NULL OR v_status <> 'ativo' THEN
        RETURN false;
    END IF;

    IF v_papel = 'coord_campanha' THEN
        RETURN true;
    END IF;

    IF v_funcao IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM funcao_permissoes
            WHERE funcao_id = v_funcao AND permissao = p
        );
    END IF;

    RETURN CASE v_papel
        WHEN 'candidato' THEN
            p IN ('ver_eleitores', 'ver_apoiadores', 'ver_liderancas', 'ver_auditoria', 'ver_ativos_politicos')
        WHEN 'advogado_responsavel' THEN
            p IN ('registrar_monitoramento', 'ver_auditoria', 'gerenciar_pecas',
                   'aprovar_pecas', 'gerenciar_tarefas', 'publicar_avisos')
        WHEN 'assistente_juridico' THEN
            p IN ('registrar_monitoramento', 'ver_auditoria', 'gerenciar_pecas',
                   'aprovar_pecas', 'gerenciar_tarefas', 'publicar_avisos')
        WHEN 'coord_marketing' THEN
            p IN ('ver_apoiadores', 'gerenciar_apoiadores', 'ver_liderancas',
                   'gerenciar_liderancas', 'enviar_mensagens', 'gerenciar_modelos',
                   'aprovar_modelos', 'publicar_avisos', 'gerenciar_pecas',
                   'aprovar_pecas', 'usar_ia', 'gerenciar_concorrentes',
                   'gerenciar_demandas', 'gerenciar_tarefas',
                   'gerenciar_base_conhecimento', 'registrar_monitoramento',
                   'ver_ativos_politicos', 'gerenciar_ativos_politicos')
        WHEN 'redator_marketing' THEN
            p IN ('gerenciar_modelos', 'publicar_avisos', 'gerenciar_pecas',
                   'usar_ia', 'gerenciar_tarefas')
        WHEN 'embaixador' THEN
            p IN ('ver_eleitores', 'cadastrar_eleitores')
        ELSE false
    END;
END;
$$;

-- ============================================================================
-- 11. SEED — categorias padrão para campanhas existentes
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_categorias_ativos(p_campanha_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO categorias_ativo_politico (campanha_id, nome, grupo, ordem) VALUES
        -- Lideranças
        (p_campanha_id, 'Liderança comunitária',   'liderancas', 1),
        (p_campanha_id, 'Liderança empresarial',   'liderancas', 2),
        (p_campanha_id, 'Liderança religiosa',     'liderancas', 3),
        (p_campanha_id, 'Liderança sindical',       'liderancas', 4),
        (p_campanha_id, 'Liderança de cooperativa', 'liderancas', 5),
        (p_campanha_id, 'Liderança de associação',  'liderancas', 6),
        (p_campanha_id, 'Liderança de categoria',   'liderancas', 7),
        (p_campanha_id, 'Liderança social',         'liderancas', 8),
        -- Executivo
        (p_campanha_id, 'Governador',        'executivo', 10),
        (p_campanha_id, 'Vice-governador',   'executivo', 11),
        (p_campanha_id, 'Prefeito',          'executivo', 12),
        (p_campanha_id, 'Vice-prefeito',     'executivo', 13),
        (p_campanha_id, 'Ex-prefeito',       'executivo', 14),
        (p_campanha_id, 'Secretário municipal', 'executivo', 15),
        (p_campanha_id, 'Secretário estadual',  'executivo', 16),
        -- Legislativo
        (p_campanha_id, 'Senador',           'legislativo', 20),
        (p_campanha_id, 'Deputado federal',  'legislativo', 21),
        (p_campanha_id, 'Deputado estadual', 'legislativo', 22),
        (p_campanha_id, 'Vereador',          'legislativo', 23),
        (p_campanha_id, 'Ex-vereador',       'legislativo', 24),
        -- Partidário
        (p_campanha_id, 'Presidente partidário',        'partidario', 30),
        (p_campanha_id, 'Dirigente partidário',         'partidario', 31),
        (p_campanha_id, 'Coordenador estadual',         'partidario', 32),
        (p_campanha_id, 'Coordenador macrorregional',   'partidario', 33),
        (p_campanha_id, 'Coordenador regional',         'partidario', 34),
        (p_campanha_id, 'Coordenador municipal',        'partidario', 35),
        (p_campanha_id, 'Coordenador partidário',       'partidario', 36),
        (p_campanha_id, 'Filiado com relevância territorial', 'partidario', 37),
        -- Sociedade organizada
        (p_campanha_id, 'Presidente de entidade',   'sociedade', 40),
        (p_campanha_id, 'Associação',               'sociedade', 41),
        (p_campanha_id, 'Sindicato',                'sociedade', 42),
        (p_campanha_id, 'Cooperativa',              'sociedade', 43),
        (p_campanha_id, 'Organização empresarial',  'sociedade', 44),
        (p_campanha_id, 'Organização profissional', 'sociedade', 45),
        (p_campanha_id, 'Instituição religiosa',    'sociedade', 46),
        (p_campanha_id, 'Movimento social',         'sociedade', 47),
        -- Outros
        (p_campanha_id, 'Empresário influente',         'outros', 50),
        (p_campanha_id, 'Articulador político',         'outros', 51),
        (p_campanha_id, 'Influenciador territorial',    'outros', 52),
        (p_campanha_id, 'Representante institucional',  'outros', 53),
        (p_campanha_id, 'Liderança setorial',           'outros', 54),
        (p_campanha_id, 'Outro',                        'outros', 99)
    ON CONFLICT (campanha_id, nome) DO NOTHING;

    INSERT INTO tipos_relacionamento_ativo (campanha_id, nome, direcional) VALUES
        (p_campanha_id, 'Lidera', true),
        (p_campanha_id, 'É coordenado por', true),
        (p_campanha_id, 'Trabalha com', false),
        (p_campanha_id, 'É aliado de', false),
        (p_campanha_id, 'É adversário de', false),
        (p_campanha_id, 'Pertence à entidade', true),
        (p_campanha_id, 'Possui influência no município', true),
        (p_campanha_id, 'Está ligado ao partido', true),
        (p_campanha_id, 'Possui relacionamento com o candidato', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING;
END;
$$;

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM campanhas LOOP
        PERFORM seed_categorias_ativos(r.id);
    END LOOP;
END;
$$;
