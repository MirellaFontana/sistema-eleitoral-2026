-- Devs podem atualizar e inserir em usuarios_internos para trocar de campanha.

CREATE POLICY usuarios_internos_dev_update ON usuarios_internos
    FOR UPDATE USING (is_dev_plataforma())
    WITH CHECK (is_dev_plataforma());

CREATE POLICY usuarios_internos_dev_insert ON usuarios_internos
    FOR INSERT WITH CHECK (is_dev_plataforma());
