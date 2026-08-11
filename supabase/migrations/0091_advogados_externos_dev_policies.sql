-- Permitir que devs gerenciem advogados externos pela UI

CREATE POLICY advogados_externos_dev_select ON advogados_externos
    FOR SELECT USING (is_dev_plataforma());

CREATE POLICY advogados_externos_dev_insert ON advogados_externos
    FOR INSERT WITH CHECK (is_dev_plataforma());

CREATE POLICY advogados_externos_dev_update ON advogados_externos
    FOR UPDATE USING (is_dev_plataforma());
