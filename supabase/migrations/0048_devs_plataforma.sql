-- Devs da plataforma — acesso full a todas as campanhas.
-- Não é um papel de campanha: é um registro por email que bypassa o isolamento de tenant.

CREATE TABLE devs_plataforma (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sem RLS — só acessível via SECURITY DEFINER functions e service_role.
-- Ninguém com anon key consegue ler esta tabela diretamente.
ALTER TABLE devs_plataforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE devs_plataforma FORCE ROW LEVEL SECURITY;

GRANT SELECT ON devs_plataforma TO authenticated;

-- Helper: verifica se o auth.uid() atual é dev da plataforma.
CREATE OR REPLACE FUNCTION is_dev_plataforma()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM devs_plataforma
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND ativo = true
    );
$$;

-- Atualizar current_campanha_id: se é dev e tem um registro em usuarios_internos, usa
-- esse; se é dev mas NÃO tem usuarios_internos, permite acessar qualquer campanha
-- passada via setting 'app.campanha_id' (set pelo middleware/server).
-- Para usuários normais, comportamento idêntico ao anterior.
CREATE OR REPLACE FUNCTION current_campanha_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_campanha UUID;
    v_override UUID;
BEGIN
    -- Dev com override ativo: prioridade máxima
    IF is_dev_plataforma() THEN
        BEGIN
            v_override := current_setting('app.campanha_id', true)::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_override := NULL;
        END;
        IF v_override IS NOT NULL THEN
            RETURN v_override;
        END IF;
    END IF;

    -- Caminho padrão: usuario_interno ativo
    SELECT campanha_id INTO v_campanha
    FROM usuarios_internos
    WHERE id = auth.uid() AND status = 'ativo';

    RETURN v_campanha;
END;
$$;

-- Atualizar has_permission: devs têm todas as permissões.
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
    -- Dev da plataforma tem todas as permissões
    IF is_dev_plataforma() THEN
        RETURN true;
    END IF;

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

-- Atualizar current_papel: devs retornam 'coord_campanha' (máxima permissão).
CREATE OR REPLACE FUNCTION current_papel()
RETURNS papel_usuario
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_papel papel_usuario;
BEGIN
    SELECT papel INTO v_papel
    FROM usuarios_internos
    WHERE id = auth.uid() AND status = 'ativo';

    IF v_papel IS NOT NULL THEN
        RETURN v_papel;
    END IF;

    IF is_dev_plataforma() THEN
        RETURN 'coord_campanha';
    END IF;

    RETURN NULL;
END;
$$;

-- Seed: registrar o email dev
INSERT INTO devs_plataforma (email, nome) VALUES
    ('mirellamidia2021@gmail.com', 'Mirella (Dev)');

-- Policy para devs verem a si mesmos
CREATE POLICY devs_plataforma_self_select ON devs_plataforma
    FOR SELECT USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
