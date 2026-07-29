-- Trigger de auditoria em funcao_permissoes (pendência técnica).
-- Vínculo usuário↔função é a coluna funcao_id em usuarios_internos, não uma tabela separada
-- ("funcao_membros" nunca existiu) — já coberta pelo trigger trg_audit_usuarios_internos (0061).

CREATE TRIGGER trg_audit_funcao_permissoes
    AFTER INSERT OR UPDATE OR DELETE ON funcao_permissoes
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
