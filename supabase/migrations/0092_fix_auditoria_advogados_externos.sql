-- Persiste fix aplicado via SQL Editor: registrar_auditoria() falhava em
-- advogados_externos porque a tabela não tem coluna campanha_id.
-- Adiciona 'advogados_externos' ao branch que já trata prazos_eleitorais.

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
  ELSIF TG_TABLE_NAME IN ('prazos_eleitorais', 'advogados_externos') THEN
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
