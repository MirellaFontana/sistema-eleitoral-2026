-- Sistema de permissões granulares delegáveis
-- (ref. specs.md [2026-07-22] "Sistema de permissões granulares delegáveis")
--
-- Substitui o sistema de papéis fixos com permissões hardcoded por funções
-- customizáveis pelo coordenador de campanha. O coord_campanha cria funções
-- (ex: "Voluntário de campo"), atribui permissões granulares a cada uma, e
-- vincula membros da equipe à função apropriada.
--
-- Controles não-delegáveis (editar_campanha, gerenciar_equipe, encaminhar_justica,
-- enviar_msg_eleitor, vincular_cidadao) permanecem hardcoded no papel fixo.

-- ============================================================================
-- 1. TABELAS NOVAS
-- ============================================================================

CREATE TABLE funcoes_campanha (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    nome        TEXT NOT NULL,
    descricao   TEXT,
    sistema     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campanha_id, nome)
);

CREATE TYPE permissao_sistema AS ENUM (
    -- Cadastros
    'ver_eleitores',
    'cadastrar_eleitores',
    'editar_eleitores',
    'ver_apoiadores',
    'gerenciar_apoiadores',
    'ver_liderancas',
    'gerenciar_liderancas',
    -- Comunicação
    'enviar_mensagens',
    'gerenciar_modelos',
    'aprovar_modelos',
    'publicar_avisos',
    -- Marketing
    'gerenciar_pecas',
    'aprovar_pecas',
    'usar_ia',
    'gerenciar_concorrentes',
    'gerenciar_demandas',
    -- Gestão
    'gerenciar_agenda',
    'gerenciar_tarefas',
    'gerenciar_territorios',
    'gerenciar_base_conhecimento',
    -- Monitoramento/Jurídico
    'registrar_monitoramento',
    'ver_auditoria'
);

CREATE TABLE funcao_permissoes (
    funcao_id  UUID NOT NULL REFERENCES funcoes_campanha(id) ON DELETE CASCADE,
    permissao  permissao_sistema NOT NULL,
    PRIMARY KEY (funcao_id, permissao)
);

-- Coluna de vínculo em usuarios_internos
ALTER TABLE usuarios_internos ADD COLUMN funcao_id UUID REFERENCES funcoes_campanha(id);

-- Índices
CREATE INDEX idx_funcoes_campanha_campanha ON funcoes_campanha (campanha_id);
CREATE INDEX idx_usuarios_internos_funcao ON usuarios_internos (funcao_id);

-- ============================================================================
-- 2. RLS NAS TABELAS NOVAS
-- ============================================================================

ALTER TABLE funcoes_campanha ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcoes_campanha FORCE ROW LEVEL SECURITY;
ALTER TABLE funcao_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcao_permissoes FORCE ROW LEVEL SECURITY;

-- funcoes_campanha: leitura por qualquer membro ativo; escrita só coord_campanha
CREATE POLICY funcoes_campanha_select ON funcoes_campanha
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY funcoes_campanha_insert ON funcoes_campanha
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() = 'coord_campanha'
    );

CREATE POLICY funcoes_campanha_update ON funcoes_campanha
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha')
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY funcoes_campanha_delete ON funcoes_campanha
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND current_papel() = 'coord_campanha'
        AND sistema = false
    );

-- funcao_permissoes: leitura por qualquer membro ativo (via join com funcao da campanha);
-- escrita só coord_campanha
CREATE POLICY funcao_permissoes_select ON funcao_permissoes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM funcoes_campanha fc
            WHERE fc.id = funcao_permissoes.funcao_id
              AND fc.campanha_id = current_campanha_id()
        )
    );

CREATE POLICY funcao_permissoes_insert ON funcao_permissoes
    FOR INSERT WITH CHECK (
        current_papel() = 'coord_campanha'
        AND EXISTS (
            SELECT 1 FROM funcoes_campanha fc
            WHERE fc.id = funcao_permissoes.funcao_id
              AND fc.campanha_id = current_campanha_id()
        )
    );

CREATE POLICY funcao_permissoes_delete ON funcao_permissoes
    FOR DELETE USING (
        current_papel() = 'coord_campanha'
        AND EXISTS (
            SELECT 1 FROM funcoes_campanha fc
            WHERE fc.id = funcao_permissoes.funcao_id
              AND fc.campanha_id = current_campanha_id()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON funcoes_campanha TO authenticated;
GRANT SELECT, INSERT, DELETE ON funcao_permissoes TO authenticated;
REVOKE ALL ON funcoes_campanha FROM anon;
REVOKE ALL ON funcao_permissoes FROM anon;

-- ============================================================================
-- 3. FUNÇÃO CENTRAL: has_permission(permissao)
-- ============================================================================

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
    -- Buscar papel, função e status do usuário logado
    SELECT papel, funcao_id, status
    INTO v_papel, v_funcao, v_status
    FROM usuarios_internos
    WHERE id = auth.uid();

    -- Usuário não encontrado ou inativo → sem permissão
    IF v_papel IS NULL OR v_status <> 'ativo' THEN
        RETURN false;
    END IF;

    -- coord_campanha tem todas as permissões delegáveis
    IF v_papel = 'coord_campanha' THEN
        RETURN true;
    END IF;

    -- Se o usuário tem funcao_id, verificar na tabela de permissões
    IF v_funcao IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM funcao_permissoes
            WHERE funcao_id = v_funcao AND permissao = p
        );
    END IF;

    -- Fallback: usuário sem funcao_id usa as permissões implícitas do papel fixo
    -- (backward compatibility durante a transição)
    RETURN CASE v_papel
        WHEN 'candidato' THEN
            p IN ('ver_eleitores', 'ver_apoiadores', 'ver_liderancas', 'ver_auditoria')
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
                   'gerenciar_base_conhecimento', 'registrar_monitoramento')
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
-- 4. ATUALIZAR POLICIES EXISTENTES PARA USAR has_permission()
-- ============================================================================

-- === TERRITÓRIOS ===
DROP POLICY IF EXISTS territorios_insert ON territorios;
CREATE POLICY territorios_insert ON territorios
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_territorios')
    );

DROP POLICY IF EXISTS territorios_update ON territorios;
CREATE POLICY territorios_update ON territorios
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_territorios'))
    WITH CHECK (campanha_id = current_campanha_id());

-- === CIDADÃOS ===
DROP POLICY IF EXISTS cidadaos_select ON cidadaos;
CREATE POLICY cidadaos_select ON cidadaos
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND has_permission('ver_eleitores')
        AND (
            current_papel() <> 'embaixador'
            OR territorio_id = current_territorio_id()
        )
    );

DROP POLICY IF EXISTS cidadaos_insert_embaixador ON cidadaos;
CREATE POLICY cidadaos_insert_embaixador ON cidadaos
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('cadastrar_eleitores')
        AND current_papel() = 'embaixador'
        AND territorio_id = current_territorio_id()
        AND origem_cadastro = 'embaixador'
    );

DROP POLICY IF EXISTS cidadaos_insert_formulario ON cidadaos;
CREATE POLICY cidadaos_insert_formulario ON cidadaos
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('cadastrar_eleitores')
        AND current_papel() <> 'embaixador'
    );

DROP POLICY IF EXISTS cidadaos_insert_iniciativa_propria ON cidadaos;
CREATE POLICY cidadaos_insert_iniciativa_propria ON cidadaos
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('cadastrar_eleitores')
        AND origem_cadastro = 'iniciativa_propria'
    );

DROP POLICY IF EXISTS cidadaos_update_coord ON cidadaos;
CREATE POLICY cidadaos_update_coord ON cidadaos
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('editar_eleitores'))
    WITH CHECK (campanha_id = current_campanha_id());

-- === CONSENTIMENTOS ===
DROP POLICY IF EXISTS consentimentos_select ON consentimentos_lgpd;
CREATE POLICY consentimentos_select ON consentimentos_lgpd
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND has_permission('ver_eleitores')
    );

-- === LOG DE AUDITORIA ===
DROP POLICY IF EXISTS log_auditoria_select ON log_auditoria;
CREATE POLICY log_auditoria_select ON log_auditoria
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND has_permission('ver_auditoria')
    );

-- === BASE DE CONHECIMENTO ===
DROP POLICY IF EXISTS temas_campanha_insert ON temas_campanha;
CREATE POLICY temas_campanha_insert ON temas_campanha
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_base_conhecimento')
    );

DROP POLICY IF EXISTS temas_campanha_update ON temas_campanha;
CREATE POLICY temas_campanha_update ON temas_campanha
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_base_conhecimento'))
    WITH CHECK (campanha_id = current_campanha_id());

DROP POLICY IF EXISTS base_conhecimento_itens_insert ON base_conhecimento_itens;
CREATE POLICY base_conhecimento_itens_insert ON base_conhecimento_itens
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM temas_campanha t WHERE t.id = base_conhecimento_itens.tema_id AND t.campanha_id = current_campanha_id())
        AND has_permission('gerenciar_base_conhecimento')
    );

DROP POLICY IF EXISTS base_conhecimento_itens_update ON base_conhecimento_itens;
CREATE POLICY base_conhecimento_itens_update ON base_conhecimento_itens
    FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM temas_campanha t WHERE t.id = base_conhecimento_itens.tema_id AND t.campanha_id = current_campanha_id())
        AND has_permission('gerenciar_base_conhecimento')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM temas_campanha t WHERE t.id = base_conhecimento_itens.tema_id AND t.campanha_id = current_campanha_id())
    );

DROP POLICY IF EXISTS base_conhecimento_itens_delete ON base_conhecimento_itens;
CREATE POLICY base_conhecimento_itens_delete ON base_conhecimento_itens
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM temas_campanha t WHERE t.id = base_conhecimento_itens.tema_id AND t.campanha_id = current_campanha_id())
        AND has_permission('gerenciar_base_conhecimento')
    );

-- === MONITORAMENTO ===
DROP POLICY IF EXISTS monitoramento_itens_insert ON monitoramento_itens;
CREATE POLICY monitoramento_itens_insert ON monitoramento_itens
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('registrar_monitoramento')
    );

DROP POLICY IF EXISTS monitoramento_itens_update ON monitoramento_itens;
CREATE POLICY monitoramento_itens_update ON monitoramento_itens
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('registrar_monitoramento'))
    WITH CHECK (campanha_id = current_campanha_id());

-- === PEÇAS DE CONTEÚDO ===
DROP POLICY IF EXISTS pecas_conteudo_insert ON pecas_conteudo;
CREATE POLICY pecas_conteudo_insert ON pecas_conteudo
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_pecas')
    );

DROP POLICY IF EXISTS pecas_conteudo_update ON pecas_conteudo;
CREATE POLICY pecas_conteudo_update ON pecas_conteudo
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_pecas'))
    WITH CHECK (campanha_id = current_campanha_id());

-- === CONCORRENTES ===
DROP POLICY IF EXISTS concorrentes_insert ON concorrentes;
CREATE POLICY concorrentes_insert ON concorrentes
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_concorrentes')
    );

DROP POLICY IF EXISTS concorrentes_update ON concorrentes;
CREATE POLICY concorrentes_update ON concorrentes
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_concorrentes'))
    WITH CHECK (campanha_id = current_campanha_id());

DROP POLICY IF EXISTS concorrentes_delete ON concorrentes;
CREATE POLICY concorrentes_delete ON concorrentes
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_concorrentes')
    );

-- === DEMANDAS ===
DROP POLICY IF EXISTS demandas_observadas_insert ON demandas_observadas;
CREATE POLICY demandas_observadas_insert ON demandas_observadas
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_demandas')
    );

DROP POLICY IF EXISTS demandas_observadas_update ON demandas_observadas;
CREATE POLICY demandas_observadas_update ON demandas_observadas
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_demandas'))
    WITH CHECK (campanha_id = current_campanha_id());

DROP POLICY IF EXISTS demandas_observadas_delete ON demandas_observadas;
CREATE POLICY demandas_observadas_delete ON demandas_observadas
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_demandas')
    );

-- === FAQs ===
DROP POLICY IF EXISTS faqs_insert ON faqs;
CREATE POLICY faqs_insert ON faqs
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('usar_ia')
    );

DROP POLICY IF EXISTS faqs_update ON faqs;
CREATE POLICY faqs_update ON faqs
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('usar_ia'))
    WITH CHECK (campanha_id = current_campanha_id());

DROP POLICY IF EXISTS faqs_delete ON faqs;
CREATE POLICY faqs_delete ON faqs
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND has_permission('usar_ia')
    );

-- === SUGESTÕES DE CONTEÚDO (IA) ===
DROP POLICY IF EXISTS sugestoes_conteudo_insert ON sugestoes_conteudo;
CREATE POLICY sugestoes_conteudo_insert ON sugestoes_conteudo
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('usar_ia')
    );

-- === ANÁLISES DE CAMPANHA (IA) ===
DROP POLICY IF EXISTS analises_campanha_insert ON analises_campanha;
CREATE POLICY analises_campanha_insert ON analises_campanha
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('usar_ia')
    );

-- === AVALIAÇÕES DE PEÇAS ===
DROP POLICY IF EXISTS avaliacoes_pecas_insert ON avaliacoes_pecas;
CREATE POLICY avaliacoes_pecas_insert ON avaliacoes_pecas
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('aprovar_pecas')
    );

-- === RESPOSTAS PARA REDES SOCIAIS ===
DROP POLICY IF EXISTS respostas_redes_sociais_insert ON respostas_redes_sociais;
CREATE POLICY respostas_redes_sociais_insert ON respostas_redes_sociais
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('usar_ia')
    );

-- === LIDERANÇAS ===
DROP POLICY IF EXISTS liderancas_insert ON liderancas;
CREATE POLICY liderancas_insert ON liderancas
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_liderancas')
    );

DROP POLICY IF EXISTS liderancas_update ON liderancas;
CREATE POLICY liderancas_update ON liderancas
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_liderancas'))
    WITH CHECK (campanha_id = current_campanha_id());

-- === METAS ===
DROP POLICY IF EXISTS metas_insert ON metas;
CREATE POLICY metas_insert ON metas
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM liderancas l WHERE l.id = metas.lideranca_id AND l.campanha_id = current_campanha_id())
        AND has_permission('gerenciar_liderancas')
    );

DROP POLICY IF EXISTS metas_update ON metas;
CREATE POLICY metas_update ON metas
    FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM liderancas l WHERE l.id = metas.lideranca_id AND l.campanha_id = current_campanha_id())
        AND has_permission('gerenciar_liderancas')
    );

DROP POLICY IF EXISTS metas_delete ON metas;
CREATE POLICY metas_delete ON metas
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM liderancas l WHERE l.id = metas.lideranca_id AND l.campanha_id = current_campanha_id())
        AND has_permission('gerenciar_liderancas')
    );

-- === TAREFAS ===
DROP POLICY IF EXISTS tarefas_insert ON tarefas;
CREATE POLICY tarefas_insert ON tarefas
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_tarefas')
    );

DROP POLICY IF EXISTS tarefas_update ON tarefas;
CREATE POLICY tarefas_update ON tarefas
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_tarefas'))
    WITH CHECK (campanha_id = current_campanha_id());

DROP POLICY IF EXISTS tarefas_delete ON tarefas;
CREATE POLICY tarefas_delete ON tarefas
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_tarefas')
    );

-- === APOIADORES ===
DROP POLICY IF EXISTS apoiadores_select ON apoiadores;
CREATE POLICY apoiadores_select ON apoiadores
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND has_permission('ver_apoiadores')
    );

DROP POLICY IF EXISTS apoiadores_insert ON apoiadores;
CREATE POLICY apoiadores_insert ON apoiadores
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_apoiadores')
    );

DROP POLICY IF EXISTS apoiadores_update ON apoiadores;
CREATE POLICY apoiadores_update ON apoiadores
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_apoiadores'))
    WITH CHECK (campanha_id = current_campanha_id());

-- === MENSAGENS ===
DROP POLICY IF EXISTS mensagens_insert ON mensagens;
CREATE POLICY mensagens_insert ON mensagens
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('enviar_mensagens')
    );

-- === MODELOS DE MENSAGEM ===
DROP POLICY IF EXISTS modelos_mensagem_insert ON modelos_mensagem;
CREATE POLICY modelos_mensagem_insert ON modelos_mensagem
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_modelos')
    );

DROP POLICY IF EXISTS modelos_mensagem_update ON modelos_mensagem;
CREATE POLICY modelos_mensagem_update ON modelos_mensagem
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_modelos'))
    WITH CHECK (campanha_id = current_campanha_id());

DROP POLICY IF EXISTS modelos_mensagem_delete ON modelos_mensagem;
CREATE POLICY modelos_mensagem_delete ON modelos_mensagem
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_modelos')
    );

-- === AVISOS INTERNOS ===
DROP POLICY IF EXISTS avisos_internos_insert ON avisos_internos;
CREATE POLICY avisos_internos_insert ON avisos_internos
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('publicar_avisos')
    );

-- === AGENDA ===
DROP POLICY IF EXISTS eventos_campanha_insert ON eventos_campanha;
CREATE POLICY eventos_campanha_insert ON eventos_campanha
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_agenda')
    );

DROP POLICY IF EXISTS eventos_campanha_update ON eventos_campanha;
CREATE POLICY eventos_campanha_update ON eventos_campanha
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('gerenciar_agenda'))
    WITH CHECK (campanha_id = current_campanha_id());

DROP POLICY IF EXISTS eventos_campanha_delete ON eventos_campanha;
CREATE POLICY eventos_campanha_delete ON eventos_campanha
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND has_permission('gerenciar_agenda')
    );

DROP POLICY IF EXISTS eventos_liderancas_insert ON eventos_liderancas;
CREATE POLICY eventos_liderancas_insert ON eventos_liderancas
    FOR INSERT WITH CHECK (
        has_permission('gerenciar_agenda')
        AND EXISTS (
            SELECT 1 FROM eventos_campanha e
            WHERE e.id = eventos_liderancas.evento_id
              AND e.campanha_id = current_campanha_id()
        )
    );

DROP POLICY IF EXISTS eventos_liderancas_update ON eventos_liderancas;
CREATE POLICY eventos_liderancas_update ON eventos_liderancas
    FOR UPDATE
    USING (
        has_permission('gerenciar_agenda')
        AND EXISTS (
            SELECT 1 FROM eventos_campanha e
            WHERE e.id = eventos_liderancas.evento_id
              AND e.campanha_id = current_campanha_id()
        )
    );

DROP POLICY IF EXISTS eventos_liderancas_delete ON eventos_liderancas;
CREATE POLICY eventos_liderancas_delete ON eventos_liderancas
    FOR DELETE USING (
        has_permission('gerenciar_agenda')
        AND EXISTS (
            SELECT 1 FROM eventos_campanha e
            WHERE e.id = eventos_liderancas.evento_id
              AND e.campanha_id = current_campanha_id()
        )
    );

-- === TERMOS DE MONITORAMENTO ===
DROP POLICY IF EXISTS termos_monitoramento_insert ON termos_monitoramento;
CREATE POLICY termos_monitoramento_insert ON termos_monitoramento
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND has_permission('registrar_monitoramento')
    );

DROP POLICY IF EXISTS termos_monitoramento_update ON termos_monitoramento;
CREATE POLICY termos_monitoramento_update ON termos_monitoramento
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND has_permission('registrar_monitoramento'))
    WITH CHECK (campanha_id = current_campanha_id());

DROP POLICY IF EXISTS termos_monitoramento_delete ON termos_monitoramento;
CREATE POLICY termos_monitoramento_delete ON termos_monitoramento
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND has_permission('registrar_monitoramento')
    );

-- ============================================================================
-- 5. ATUALIZAR TRIGGERS QUE CHECAM PAPEL
-- ============================================================================

-- restringir_aprovacao_pecas_conteudo: agora usa has_permission('aprovar_pecas')
CREATE OR REPLACE FUNCTION restringir_aprovacao_pecas_conteudo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status
        OR OLD.rotulo_ia IS DISTINCT FROM NEW.rotulo_ia
        OR OLD.publicado_em IS DISTINCT FROM NEW.publicado_em)
    THEN
        IF NOT has_permission('aprovar_pecas') THEN
            RAISE EXCEPTION 'Somente papéis com permissão aprovar_pecas podem aprovar, rotular ou publicar peças.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- restringir_aprovacao_modelo_mensagem: agora usa has_permission('aprovar_modelos')
CREATE OR REPLACE FUNCTION restringir_aprovacao_modelo_mensagem()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status
        OR OLD.aprovado_por IS DISTINCT FROM NEW.aprovado_por
        OR OLD.aprovado_em IS DISTINCT FROM NEW.aprovado_em)
       AND NOT (
           OLD.conteudo IS DISTINCT FROM NEW.conteudo
       )
    THEN
        IF NOT has_permission('aprovar_modelos') THEN
            RAISE EXCEPTION 'Somente papéis com permissão aprovar_modelos podem aprovar modelos de mensagem.'
                USING ERRCODE = 'P0001';
        END IF;
        NEW.aprovado_por := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 6. SEED: FUNÇÕES PADRÃO POR CAMPANHA EXISTENTE
-- ============================================================================

-- Função para criar as funções padrão de uma campanha (reusável pelo bootstrap)
CREATE OR REPLACE FUNCTION criar_funcoes_padrao(p_campanha_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_funcao_id UUID;
BEGIN
    -- Coordenador de campanha (todas as 22 permissões)
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

    -- Candidato
    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Candidato', 'Visão executiva — vê dados agregados e nominais, sem edição', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING
    RETURNING id INTO v_funcao_id;
    IF v_funcao_id IS NOT NULL THEN
        INSERT INTO funcao_permissoes (funcao_id, permissao) VALUES
            (v_funcao_id, 'ver_eleitores'),
            (v_funcao_id, 'ver_apoiadores'),
            (v_funcao_id, 'ver_liderancas'),
            (v_funcao_id, 'ver_auditoria')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Advogado responsável
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

    -- Assistente jurídico
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

    -- Coordenador de marketing
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
            (v_funcao_id, 'registrar_monitoramento')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Redator de marketing
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

    -- Embaixador (liderança de campo)
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

    -- Apoio marketing (vazio por padrão — coordenador customiza)
    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Apoio marketing', 'Sem permissões padrão — o coordenador customiza', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING;

    -- Apoio campanha (vazio por padrão)
    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Apoio campanha', 'Sem permissões padrão — o coordenador customiza', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING;

    -- Apoio coordenação (vazio por padrão)
    INSERT INTO funcoes_campanha (campanha_id, nome, descricao, sistema)
    VALUES (p_campanha_id, 'Apoio coordenação', 'Sem permissões padrão — o coordenador customiza', true)
    ON CONFLICT (campanha_id, nome) DO NOTHING;
END;
$$;

-- Criar funções padrão para todas as campanhas existentes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM campanhas LOOP
        PERFORM criar_funcoes_padrao(r.id);
    END LOOP;
END;
$$;

-- Vincular usuarios_internos existentes à funcao_id correspondente ao seu papel
UPDATE usuarios_internos ui
SET funcao_id = fc.id
FROM funcoes_campanha fc
WHERE fc.campanha_id = ui.campanha_id
  AND fc.sistema = true
  AND (
      (ui.papel = 'coord_campanha' AND fc.nome = 'Coordenador de campanha')
      OR (ui.papel = 'candidato' AND fc.nome = 'Candidato')
      OR (ui.papel = 'advogado_responsavel' AND fc.nome = 'Advogado responsável')
      OR (ui.papel = 'assistente_juridico' AND fc.nome = 'Assistente jurídico')
      OR (ui.papel = 'coord_marketing' AND fc.nome = 'Coordenador de marketing')
      OR (ui.papel = 'redator_marketing' AND fc.nome = 'Redator de marketing')
      OR (ui.papel = 'embaixador' AND fc.nome = 'Embaixador')
      OR (ui.papel = 'apoio_marketing' AND fc.nome = 'Apoio marketing')
      OR (ui.papel = 'apoio_campanha' AND fc.nome = 'Apoio campanha')
      OR (ui.papel = 'apoio_coordenacao' AND fc.nome = 'Apoio coordenação')
  );

-- ============================================================================
-- 7. ATUALIZAR bootstrap_campanha() PARA CRIAR FUNÇÕES PADRÃO
-- ============================================================================

-- Adicionar chamada a criar_funcoes_padrao() no bootstrap existente.
-- A função bootstrap_campanha() é SECURITY DEFINER e já cria a campanha +
-- o primeiro usuario_interno. Agora também cria as funções padrão e vincula
-- o primeiro usuário à função "Coordenador de campanha".
-- (A alteração real está abaixo — recria a função com a lógica adicionada.)

CREATE OR REPLACE FUNCTION bootstrap_campanha(
    p_nome_candidato TEXT,
    p_cargo TEXT DEFAULT NULL,
    p_uf CHAR(2) DEFAULT NULL,
    p_partido TEXT DEFAULT NULL,
    p_nome_usuario TEXT DEFAULT 'Coordenador'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_campanha_id UUID;
    v_funcao_cc_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF EXISTS (SELECT 1 FROM usuarios_internos WHERE id = v_user_id) THEN
        RAISE EXCEPTION 'Usuário já pertence a uma campanha.';
    END IF;

    INSERT INTO campanhas (nome_candidato, cargo, uf, partido)
    VALUES (p_nome_candidato, p_cargo, p_uf, p_partido)
    RETURNING id INTO v_campanha_id;

    -- Criar funções padrão da campanha
    PERFORM criar_funcoes_padrao(v_campanha_id);

    -- Buscar a funcao_id de "Coordenador de campanha"
    SELECT id INTO v_funcao_cc_id
    FROM funcoes_campanha
    WHERE campanha_id = v_campanha_id AND nome = 'Coordenador de campanha';

    INSERT INTO usuarios_internos (id, campanha_id, papel, nome, exige_mfa, funcao_id)
    VALUES (v_user_id, v_campanha_id, 'coord_campanha', p_nome_usuario, true, v_funcao_cc_id);

    -- Seed do tema "Código Eleitoral" compartilhado
    INSERT INTO temas_campanha (campanha_id, nome, descricao)
    VALUES (v_campanha_id, 'Código Eleitoral',
            'Legislação eleitoral vigente — conteúdo compartilhado entre todas as campanhas.');

    INSERT INTO base_conhecimento_itens (tema_id, titulo, descricao, arquivo_path)
    SELECT t.id, titulo, descricao, arquivo_path
    FROM temas_campanha t,
    (VALUES
        ('Lei 9.504/1997 — Lei das Eleições',
         'Texto consolidado da Lei 9.504/1997 (Lei das Eleições), referência principal para regras de campanha.',
         '_global/codigo-eleitoral/lei-9504-1997-eleicoes.pdf'),
        ('Resolução TSE 23.732/2024 — Propaganda e IA',
         'Resolução que regulamenta propaganda eleitoral e uso de IA (deepfakes, conteúdo sintético, rotulagem obrigatória).',
         '_global/codigo-eleitoral/resolucao-tse-23732-2024-propaganda-ia.pdf')
    ) AS seed(titulo, descricao, arquivo_path)
    WHERE t.campanha_id = v_campanha_id AND t.nome = 'Código Eleitoral';

    RETURN v_campanha_id;
END;
$$;
