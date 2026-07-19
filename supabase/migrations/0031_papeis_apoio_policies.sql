-- Ajusta as 3 policies de leitura de PII nominal de eleitor (cidadaos, consentimentos_lgpd,
-- mensagens pra cidadão) para excluir também os 3 papéis de apoio criados na 0030 — mesmo
-- tratamento já dado a advogado_responsavel/assistente_juridico/coord_marketing/redator_marketing:
-- são papéis de suporte que não precisam de dado pessoal de eleitor pro próprio trabalho
-- (minimização LGPD). Os outros ~19 papéis/tabelas de leitura aberta (monitoramento, peças,
-- tarefas, metas, apoiadores, lideranças, alertas, etc.) continuam abertos pra qualquer papel
-- interno ativo, sem mudança — decisão do usuário de manter o mesmo padrão de acesso já usado
-- por embaixador/candidato hoje, em vez de travar cada tabela isoladamente.

DROP POLICY cidadaos_select ON cidadaos;
CREATE POLICY cidadaos_select ON cidadaos
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND current_papel() NOT IN (
            'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing',
            'apoio_marketing', 'apoio_campanha', 'apoio_coordenacao'
        )
        AND (current_papel() <> 'embaixador' OR territorio_id = current_territorio_id())
    );

DROP POLICY consentimentos_select ON consentimentos_lgpd;
CREATE POLICY consentimentos_select ON consentimentos_lgpd
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND current_papel() NOT IN (
            'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing',
            'apoio_marketing', 'apoio_campanha', 'apoio_coordenacao'
        )
    );

DROP POLICY mensagens_select ON mensagens;
CREATE POLICY mensagens_select ON mensagens
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND (
            tipo_destinatario <> 'cidadao'
            OR current_papel() NOT IN (
                'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing',
                'apoio_marketing', 'apoio_campanha', 'apoio_coordenacao'
            )
        )
    );
