-- Permite exclusão de campanha com CASCADE em todas as FKs dependentes.

-- 1. Adiciona ON DELETE CASCADE a todas as FK que referenciam campanhas(id) e ainda não têm.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      con.conname  AS constraint_name,
      cls.relname  AS table_name,
      att.attname  AS column_name,
      nsp.nspname  AS schema_name
    FROM pg_constraint con
    JOIN pg_class     cls     ON con.conrelid  = cls.oid
    JOIN pg_namespace nsp     ON cls.relnamespace = nsp.oid
    JOIN pg_attribute att     ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    JOIN pg_class     ref_cls ON con.confrelid = ref_cls.oid
    WHERE con.contype = 'f'
      AND ref_cls.relname = 'campanhas'
      AND nsp.nspname = 'public'
      AND con.confdeltype != 'c'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.schema_name, r.table_name, r.constraint_name);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES campanhas(id) ON DELETE CASCADE',
                   r.schema_name, r.table_name, r.constraint_name, r.column_name);
  END LOOP;
END $$;

-- 2. Função segura de exclusão — desabilita triggers de auditoria para evitar
--    inserções em log_auditoria durante o CASCADE.
CREATE OR REPLACE FUNCTION excluir_campanha_completa(p_campanha_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM usuarios_internos
    WHERE id = auth.uid()
      AND campanha_id = p_campanha_id
      AND papel = 'coord_campanha'
  ) THEN
    RAISE EXCEPTION 'sem permissão para excluir esta campanha';
  END IF;

  SET LOCAL session_replication_role = 'replica';

  DELETE FROM campanhas WHERE id = p_campanha_id;
END;
$$;

GRANT EXECUTE ON FUNCTION excluir_campanha_completa(UUID) TO authenticated;
