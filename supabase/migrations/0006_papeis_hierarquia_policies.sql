-- Atualiza as policies que referenciavam os papéis antigos (renomeados/expandidos na 0005) e
-- dá leitura total ao candidato (decisão do usuário — reverte a restrição original de PII do
-- §3.2 da especificação). candidato continua SEM poder administrativo: usuarios_internos_insert/
-- update e campanhas_update continuam exclusivos de coord_campanha, não tocados aqui.

-- cidadaos: leitura de PII agora exclui só os papéis "juniores sem PII" — advogado_responsavel,
-- assistente_juridico, coord_marketing, redator_marketing continuam sem ver dado nominal de
-- cidadão (não precisam pro trabalho deles); candidato passa a ver (antes era excluído também).
DROP POLICY cidadaos_select ON cidadaos;
CREATE POLICY cidadaos_select ON cidadaos
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND current_papel() NOT IN ('advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
        AND (current_papel() <> 'embaixador' OR territorio_id = current_territorio_id())
    );

DROP POLICY consentimentos_select ON consentimentos_lgpd;
CREATE POLICY consentimentos_select ON consentimentos_lgpd
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND current_papel() NOT IN ('advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
    );

-- log_auditoria: bloco jurídico completo (responsável + assistente) mantém leitura da trilha;
-- candidato ganha leitura (antes só coord_campanha/advogado liam).
DROP POLICY log_auditoria_select ON log_auditoria;
CREATE POLICY log_auditoria_select ON log_auditoria
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'candidato', 'advogado_responsavel', 'assistente_juridico')
    );

-- base de conhecimento / temas: coord_comunicacao vira coord_marketing; redator_marketing não
-- edita (só coord_campanha/coord_marketing, igual antes só com o nome novo).
DROP POLICY temas_campanha_insert ON temas_campanha;
CREATE POLICY temas_campanha_insert ON temas_campanha
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );

DROP POLICY temas_campanha_update ON temas_campanha;
CREATE POLICY temas_campanha_update ON temas_campanha
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'))
    WITH CHECK (campanha_id = current_campanha_id());

DROP POLICY base_conhecimento_itens_insert ON base_conhecimento_itens;
CREATE POLICY base_conhecimento_itens_insert ON base_conhecimento_itens
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );

DROP POLICY base_conhecimento_itens_update ON base_conhecimento_itens;
CREATE POLICY base_conhecimento_itens_update ON base_conhecimento_itens
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'))
    WITH CHECK (campanha_id = current_campanha_id());

DROP POLICY base_conhecimento_itens_delete ON base_conhecimento_itens;
CREATE POLICY base_conhecimento_itens_delete ON base_conhecimento_itens
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'));

-- Storage (base-conhecimento): mesma troca de nome de papel.
DROP POLICY base_conhecimento_storage_insert ON storage.objects;
CREATE POLICY base_conhecimento_storage_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'base-conhecimento'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );

DROP POLICY base_conhecimento_storage_update ON storage.objects;
CREATE POLICY base_conhecimento_storage_update ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'base-conhecimento'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );

DROP POLICY base_conhecimento_storage_delete ON storage.objects;
CREATE POLICY base_conhecimento_storage_delete ON storage.objects
    FOR DELETE USING (
        bucket_id = 'base-conhecimento'
        AND (storage.foldername(name))[1] = current_campanha_id()::text
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );
