-- chaves_api guarda credenciais de provedores de IA por campanha (migration 0047) mas nunca
-- ganhou trigger de auditoria — quem trocou/removeu uma chave ficava invisível na trilha.
-- to_jsonb(NEW)/(OLD) sobre chave_cifrada serializa só o ciphertext (BYTEA vira hex), nunca a
-- chave em claro, então é seguro auditar a linha inteira como as demais tabelas críticas.

CREATE TRIGGER trg_audit_chaves_api
    AFTER INSERT OR UPDATE OR DELETE ON chaves_api
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Base normativa (migration 0062) também ficou de fora: alteração no texto de um dispositivo
-- legal ou na fonte normativa que o jurídico cita é exatamente o tipo de ação que precisa
-- rastro de auditoria (seção 14 do spec — governança sobre a fonte de verdade jurídica).
CREATE TRIGGER trg_audit_fontes_normativas
    AFTER INSERT OR UPDATE OR DELETE ON fontes_normativas
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trg_audit_dispositivos_normativos
    AFTER INSERT OR UPDATE OR DELETE ON dispositivos_normativos
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
