-- Permite excluir itens de monitoramento (mesmos papeis que podem inserir/editar)
CREATE POLICY monitoramento_itens_delete ON monitoramento_itens
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
    );

GRANT DELETE ON monitoramento_itens TO authenticated;
