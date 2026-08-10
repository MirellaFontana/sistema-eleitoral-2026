-- Corrige dois bugs:
-- 1. registrar_auditoria() falhava em tabelas sem coluna campanha_id
--    (campanhas, funcao_permissoes, prazos_eleitorais)
-- 2. criar_campanha_dev() referenciava coluna arquivo_path (removida em 0009)
--    e omitia campanha_id (NOT NULL) no INSERT de base_conhecimento_itens

-- ============================================================
-- 1. Permitir NULL em log_auditoria.campanha_id
-- ============================================================
ALTER TABLE log_auditoria ALTER COLUMN campanha_id DROP NOT NULL;

-- ============================================================
-- 2. Recriar registrar_auditoria() com tratamento por tabela
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campanha_id UUID;
  v_usuario_id UUID;
  v_acao TEXT;
  v_antes JSONB;
  v_depois JSONB;
  v_entidade_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'campanhas' THEN
    v_campanha_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    v_entidade_id := v_campanha_id;
  ELSIF TG_TABLE_NAME = 'funcao_permissoes' THEN
    SELECT campanha_id INTO v_campanha_id
    FROM funcoes_campanha
    WHERE id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.funcao_id ELSE NEW.funcao_id END);
    v_entidade_id := NULL;
  ELSIF TG_TABLE_NAME = 'prazos_eleitorais' THEN
    v_campanha_id := NULL;
    v_entidade_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_campanha_id := OLD.campanha_id;
      v_entidade_id := OLD.id;
    ELSE
      v_campanha_id := NEW.campanha_id;
      v_entidade_id := NEW.id;
    END IF;
  END IF;

  v_usuario_id := auth.uid();
  v_acao := TG_OP || ':' || TG_TABLE_NAME;

  IF TG_OP = 'INSERT' THEN
    v_antes := NULL;
    v_depois := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_antes := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_antes := to_jsonb(OLD);
    v_depois := NULL;
  END IF;

  INSERT INTO log_auditoria (campanha_id, usuario_id, acao, tabela_afetada, entidade_id, antes, depois)
  VALUES (v_campanha_id, v_usuario_id, v_acao, TG_TABLE_NAME, v_entidade_id, v_antes, v_depois);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Recriar criar_campanha_dev() com colunas corretas
-- ============================================================
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
    v_tema_id UUID;
BEGIN
    IF NOT is_dev_plataforma() THEN
        RAISE EXCEPTION 'Apenas administradores da plataforma podem criar campanhas.';
    END IF;

    INSERT INTO campanhas (nome_candidato, cargo, uf, partido)
    VALUES (p_nome_candidato, p_cargo, p_uf, p_partido)
    RETURNING id INTO v_campanha_id;

    PERFORM criar_funcoes_padrao(v_campanha_id);

    INSERT INTO temas_campanha (campanha_id, nome)
    VALUES (v_campanha_id, 'Código Eleitoral')
    RETURNING id INTO v_tema_id;

    INSERT INTO base_conhecimento_itens (campanha_id, tema_id, titulo, descricao)
    VALUES
        (v_campanha_id, v_tema_id,
         'Lei 9.504/1997 — Lei das Eleições',
         'Texto consolidado da Lei 9.504/1997 (Lei das Eleições), referência principal para regras de campanha.'),
        (v_campanha_id, v_tema_id,
         'Resolução TSE 23.732/2024 — Propaganda e IA',
         'Resolução que regulamenta propaganda eleitoral e uso de IA (deepfakes, conteúdo sintético, rotulagem obrigatória).');

    RETURN v_campanha_id;
END;
$$;
