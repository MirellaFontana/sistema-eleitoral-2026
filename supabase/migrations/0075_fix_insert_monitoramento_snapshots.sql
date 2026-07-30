-- 0055 criou monitoramento_snapshots com RLS habilitado e só uma policy de SELECT — nunca
-- ganhou GRANT INSERT nem policy de INSERT. O cron (/api/cron/monitoramento) nunca sentiu isso
-- porque usa o client de service_role, que ignora RLS. Mas o botão "Buscar agora" na tela de
-- Monitoramento (/api/monitoramento/snapshot) usa o client autenticado normal — a busca real
-- rodava (13-37s), retornava sucesso, mas o INSERT do snapshot era bloqueado pela RLS e o erro
-- ficava engolido no código (só `data` era lido, não `error`), então a tela nunca atualizava e
-- parecia que "a busca não funciona".

GRANT INSERT ON monitoramento_snapshots TO authenticated;

CREATE POLICY snapshot_insert_campanha
    ON monitoramento_snapshots FOR INSERT
    WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
    );
