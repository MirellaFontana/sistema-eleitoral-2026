-- Advogado externo: profissional que compra apenas o módulo jurídico
-- e gerencia múltiplos clientes (campanhas) próprios.
-- Padrão espelhado em devs_plataforma (0048), mas com acesso restrito.

-- 1. Tabela de advogados externos (whitelist por email)
CREATE TABLE advogados_externos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE advogados_externos ENABLE ROW LEVEL SECURITY;
ALTER TABLE advogados_externos FORCE ROW LEVEL SECURITY;

CREATE POLICY advogados_externos_self_select ON advogados_externos
    FOR SELECT USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- 2. Coluna criado_por em campanhas (para saber quem criou)
ALTER TABLE campanhas ADD COLUMN criado_por UUID REFERENCES auth.users(id);

-- 3. Função is_advogado_externo()
CREATE OR REPLACE FUNCTION is_advogado_externo()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM advogados_externos
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND ativo = true
    );
$$;

-- 4. RPC criar_campanha_advogado — cria campanha + vincula o advogado
CREATE OR REPLACE FUNCTION criar_campanha_advogado(
    p_nome_candidato TEXT,
    p_cargo TEXT DEFAULT NULL,
    p_uf CHAR(2) DEFAULT NULL,
    p_partido TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_campanha_id UUID;
    v_user UUID := auth.uid();
    v_nome TEXT;
BEGIN
    IF NOT is_advogado_externo() THEN
        RAISE EXCEPTION 'Apenas advogados externos podem usar esta função.';
    END IF;

    SELECT COALESCE(raw_user_meta_data->>'nome', email)
    INTO v_nome FROM auth.users WHERE id = v_user;

    INSERT INTO campanhas (nome_candidato, cargo, uf, partido, criado_por)
    VALUES (p_nome_candidato, p_cargo, p_uf, p_partido, v_user)
    RETURNING id INTO v_campanha_id;

    PERFORM criar_funcoes_padrao(v_campanha_id);

    -- Aponta o advogado para a nova campanha
    IF EXISTS (SELECT 1 FROM usuarios_internos WHERE id = v_user) THEN
        UPDATE usuarios_internos
        SET campanha_id = v_campanha_id
        WHERE id = v_user;
    ELSE
        INSERT INTO usuarios_internos (id, campanha_id, papel, nome, telefone)
        VALUES (v_user, v_campanha_id, 'advogado_responsavel', v_nome, '0000000000');
    END IF;

    RETURN v_campanha_id;
END;
$$;

-- 5. RLS: advogado externo pode ver campanhas que criou
CREATE POLICY campanhas_adv_externo_select ON campanhas
    FOR SELECT USING (
        is_advogado_externo() AND criado_por = auth.uid()
    );

-- 6. RLS: advogado externo pode trocar sua campanha (apenas para campanhas que criou)
CREATE POLICY usuarios_internos_adv_externo_update ON usuarios_internos
    FOR UPDATE USING (
        id = auth.uid() AND is_advogado_externo()
    ) WITH CHECK (
        id = auth.uid() AND is_advogado_externo()
        AND campanha_id IN (SELECT c.id FROM campanhas c WHERE c.criado_por = auth.uid())
    );

-- 7. Incluir advogado_externo nas policies de processos eleitorais
-- (ele tem papel advogado_responsavel, que já está nas policies de 0089)
-- Nenhuma alteração necessária nas policies existentes.

-- 8. Auditoria
CREATE TRIGGER trg_audit_advogados_externos
    AFTER INSERT OR UPDATE ON advogados_externos
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
