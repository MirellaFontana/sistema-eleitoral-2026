-- Telefone obrigatório em todo cadastro de pessoa (ref. specs.md [2026-07-18]
-- "Telefone obrigatório em todo cadastro de pessoa"). cidadaos.whatsapp e apoiadores.telefone
-- já eram NOT NULL desde a criação; as lacunas eram liderancas.telefone e usuarios_internos.telefone
-- (este último nem era perguntado no onboarding, que cria o primeiro coord_campanha).

-- Backfill defensivo: registro antigo sem telefone recebe um placeholder textual óbvio, nunca um
-- número inventado — quem for usar esse registro em Mensagens/Alertas precisa perceber que falta corrigir.
UPDATE liderancas SET telefone = '(sem telefone — cadastro anterior à obrigatoriedade)' WHERE telefone IS NULL;
UPDATE usuarios_internos SET telefone = '(sem telefone — cadastro anterior à obrigatoriedade)' WHERE telefone IS NULL;

ALTER TABLE liderancas ALTER COLUMN telefone SET NOT NULL;
ALTER TABLE usuarios_internos ALTER COLUMN telefone SET NOT NULL;

-- bootstrap_campanha ganha p_telefone — muda a assinatura da função, não só o corpo, então a
-- versão antiga de 6 parâmetros precisa ser removida explicitamente antes de criar a nova.
DROP FUNCTION IF EXISTS bootstrap_campanha(TEXT, TEXT, CHAR(2), TEXT, TEXT, TEXT);

CREATE FUNCTION bootstrap_campanha(
    p_nome_candidato TEXT,
    p_cargo TEXT,
    p_uf CHAR(2),
    p_partido TEXT,
    p_plano_contratado TEXT,
    p_nome_usuario TEXT,
    p_telefone TEXT
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

    IF EXISTS (SELECT 1 FROM usuarios_internos WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'usuário autenticado já pertence a uma campanha — bootstrap não pode ser chamado de novo';
    END IF;

    IF p_telefone IS NULL OR btrim(p_telefone) = '' THEN
        RAISE EXCEPTION 'telefone é obrigatório';
    END IF;

    INSERT INTO campanhas (nome_candidato, cargo, uf, partido, plano_contratado)
    VALUES (p_nome_candidato, p_cargo, p_uf, p_partido, p_plano_contratado)
    RETURNING id INTO v_campanha_id;

    INSERT INTO usuarios_internos (id, campanha_id, papel, nome, telefone, exige_mfa, status)
    VALUES (auth.uid(), v_campanha_id, 'coord_campanha', p_nome_usuario, p_telefone, true, 'ativo');

    RETURN v_campanha_id;
END;
$$;

GRANT EXECUTE ON FUNCTION bootstrap_campanha(TEXT, TEXT, CHAR(2), TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION bootstrap_campanha(TEXT, TEXT, CHAR(2), TEXT, TEXT, TEXT, TEXT) FROM anon, public;
