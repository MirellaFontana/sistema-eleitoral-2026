-- Resolve o problema de ovo-e-galinha encontrado ao planejar as telas de cadastro (ref. specs.md):
-- não existe policy de INSERT em `campanhas`, e `usuarios_internos_insert` exige já ser coord_campanha.
-- Sem isso, ninguém autenticado consegue criar a primeira campanha nem o primeiro usuário interno.
--
-- Solução: uma única função SECURITY DEFINER que cria a campanha + o primeiro coord_campanha
-- atomicamente. Não abre policy de INSERT permanente em `campanhas` — todo o controle de quem
-- pode criar um tenant novo fica centralizado aqui, não espalhado em policies.

CREATE OR REPLACE FUNCTION bootstrap_campanha(
    p_nome_candidato TEXT,
    p_cargo TEXT,
    p_uf CHAR(2),
    p_partido TEXT,
    p_plano_contratado TEXT,
    p_nome_usuario TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_campanha_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'bootstrap_campanha exige usuário autenticado';
    END IF;

    -- Trava central: só quem ainda não pertence a nenhuma campanha pode criar uma nova por aqui.
    IF EXISTS (SELECT 1 FROM usuarios_internos WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'usuário autenticado já pertence a uma campanha — bootstrap não pode ser chamado de novo';
    END IF;

    INSERT INTO campanhas (nome_candidato, cargo, uf, partido, plano_contratado)
    VALUES (p_nome_candidato, p_cargo, p_uf, p_partido, p_plano_contratado)
    RETURNING id INTO v_campanha_id;

    -- Primeiro usuário da campanha é sempre coord_campanha, com MFA obrigatório (mesma regra de
    -- qualquer outro coord_campanha; a aplicação de MFA em si é responsabilidade do frontend/auth,
    -- exige_mfa aqui só marca a intenção no cadastro).
    INSERT INTO usuarios_internos (id, campanha_id, papel, nome, exige_mfa, status)
    VALUES (auth.uid(), v_campanha_id, 'coord_campanha', p_nome_usuario, true, 'ativo');

    RETURN v_campanha_id;
END;
$$;

-- Qualquer usuário autenticado pode chamar (a trava real é a checagem interna acima, não o GRANT).
GRANT EXECUTE ON FUNCTION bootstrap_campanha(TEXT, TEXT, CHAR(2), TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION bootstrap_campanha(TEXT, TEXT, CHAR(2), TEXT, TEXT, TEXT) FROM anon, public;
