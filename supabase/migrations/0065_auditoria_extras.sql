-- Triggers de auditoria em funcao_permissoes e funcao_membros (pendência técnica)

CREATE TRIGGER trg_audit_funcao_permissoes
    AFTER INSERT OR UPDATE OR DELETE ON funcao_permissoes
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trg_audit_funcao_membros
    AFTER INSERT OR UPDATE OR DELETE ON funcao_membros
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
