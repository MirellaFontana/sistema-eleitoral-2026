-- Apenas devs da plataforma podem criar campanhas.
-- Remove bootstrap_campanha público e cria criar_campanha_dev.

-- 1. Dropar ambas as sobrecargas de bootstrap_campanha
DROP FUNCTION IF EXISTS bootstrap_campanha(TEXT, TEXT, CHAR(2), TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS bootstrap_campanha(TEXT, TEXT, CHAR(2), TEXT, TEXT);

-- 2. Função dev-only para criar campanhas (sem inserir o dev como usuario_interno)
CREATE OR REPLACE FUNCTION criar_campanha_dev(
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
BEGIN
    IF NOT is_dev_plataforma() THEN
        RAISE EXCEPTION 'Apenas administradores da plataforma podem criar campanhas.';
    END IF;

    INSERT INTO campanhas (nome_candidato, cargo, uf, partido)
    VALUES (p_nome_candidato, p_cargo, p_uf, p_partido)
    RETURNING id INTO v_campanha_id;

    PERFORM criar_funcoes_padrao(v_campanha_id);

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

GRANT EXECUTE ON FUNCTION criar_campanha_dev(TEXT, TEXT, CHAR(2), TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION criar_campanha_dev(TEXT, TEXT, CHAR(2), TEXT) FROM anon, public;
