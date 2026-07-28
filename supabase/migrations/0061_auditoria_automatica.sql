-- Auditoria imutável automática — triggers que populam log_auditoria
-- para todas as operações críticas (decisões, permissões, diretrizes,
-- recomendações, alertas, concorrentes, tarefas, monitoramento).
--
-- log_auditoria já existe (0001) com append-only trigger e RLS.
-- Esta migration adiciona:
-- 1. Função genérica de auditoria reutilizável
-- 2. Triggers em tabelas críticas
-- 3. Índices para consulta eficiente
-- 4. Atualiza policy de SELECT para incluir papéis do spec

-- 1. Função genérica de auditoria
-- SECURITY DEFINER para poder inserir em log_auditoria independente do papel do usuário.
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
  -- Determina campanha_id do registro
  IF TG_OP = 'DELETE' THEN
    v_campanha_id := OLD.campanha_id;
    v_entidade_id := OLD.id;
  ELSE
    v_campanha_id := NEW.campanha_id;
    v_entidade_id := NEW.id;
  END IF;

  -- Obtém usuário autenticado (pode ser null em cron/service)
  v_usuario_id := auth.uid();

  -- Determina ação
  v_acao := TG_OP || ':' || TG_TABLE_NAME;

  -- Serializa antes/depois
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

-- 2. Triggers em tabelas críticas
-- Decisões e permissões
CREATE TRIGGER trg_audit_usuarios_internos
    AFTER INSERT OR UPDATE OR DELETE ON usuarios_internos
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trg_audit_campanhas
    AFTER UPDATE ON campanhas
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Diretrizes (fonte de verdade do discurso)
CREATE TRIGGER trg_audit_diretrizes_campanha
    AFTER INSERT OR UPDATE ON diretrizes_campanha
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trg_audit_diretrizes_posicoes
    AFTER INSERT OR UPDATE OR DELETE ON diretrizes_posicoes
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Recomendações (ciclo decisório)
CREATE TRIGGER trg_audit_recomendacoes
    AFTER INSERT OR UPDATE ON recomendacoes
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Alertas
CREATE TRIGGER trg_audit_alertas
    AFTER INSERT OR UPDATE ON alertas
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Concorrentes
CREATE TRIGGER trg_audit_concorrentes
    AFTER INSERT OR UPDATE OR DELETE ON concorrentes
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Tarefas
CREATE TRIGGER trg_audit_tarefas
    AFTER INSERT OR UPDATE OR DELETE ON tarefas
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Monitoramento (itens individuais)
CREATE TRIGGER trg_audit_monitoramento_itens
    AFTER INSERT OR UPDATE ON monitoramento_itens
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Temas da campanha
CREATE TRIGGER trg_audit_temas_campanha
    AFTER INSERT OR UPDATE OR DELETE ON temas_campanha
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Prazos eleitorais
CREATE TRIGGER trg_audit_prazos_eleitorais
    AFTER INSERT OR UPDATE OR DELETE ON prazos_eleitorais
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- 3. Índices para consulta eficiente da trilha
CREATE INDEX IF NOT EXISTS idx_log_auditoria_tabela ON log_auditoria (tabela_afetada);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_usuario ON log_auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_entidade ON log_auditoria (entidade_id);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_created ON log_auditoria (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_acao ON log_auditoria (acao);

-- 4. Atualiza policy de SELECT para cobrir papéis do spec (advogado_responsavel, não "advogado")
-- A policy original (0001) usava 'advogado' que não existe no enum.
-- Recriamos com os papéis corretos + permissão ver_auditoria.
DROP POLICY IF EXISTS log_auditoria_select ON log_auditoria;

CREATE POLICY log_auditoria_select ON log_auditoria
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND (
            current_papel() IN ('coord_campanha', 'candidato', 'advogado_responsavel')
            OR has_permission('ver_auditoria')
        )
    );
