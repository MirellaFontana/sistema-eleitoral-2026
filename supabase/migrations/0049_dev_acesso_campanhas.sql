-- Devs da plataforma podem ver todas as campanhas para trocar contexto.

CREATE POLICY campanhas_dev_select ON campanhas
    FOR SELECT USING (is_dev_plataforma());

-- Devs podem ver todos os usuarios_internos (para navegar entre campanhas).
CREATE POLICY usuarios_internos_dev_select ON usuarios_internos
    FOR SELECT USING (is_dev_plataforma());

-- Devs podem ver chaves_api de qualquer campanha.
CREATE POLICY chaves_api_dev_select ON chaves_api
    FOR SELECT USING (is_dev_plataforma());

CREATE POLICY chaves_api_dev_insert ON chaves_api
    FOR INSERT WITH CHECK (is_dev_plataforma());

CREATE POLICY chaves_api_dev_update ON chaves_api
    FOR UPDATE
    USING (is_dev_plataforma())
    WITH CHECK (true);

CREATE POLICY chaves_api_dev_delete ON chaves_api
    FOR DELETE USING (is_dev_plataforma());
