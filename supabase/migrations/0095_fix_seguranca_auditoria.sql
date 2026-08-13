-- Correções de segurança identificadas na auditoria de 12/08/2026

-- 1. Advogado externo: travar papel e status no UPDATE para impedir escalação
DROP POLICY IF EXISTS usuarios_internos_adv_externo_update ON usuarios_internos;

CREATE POLICY usuarios_internos_adv_externo_update ON usuarios_internos
    FOR UPDATE USING (
        id = auth.uid() AND is_advogado_externo()
    ) WITH CHECK (
        id = auth.uid() AND is_advogado_externo()
        AND campanha_id IN (SELECT c.id FROM campanhas c WHERE c.criado_por = auth.uid())
        AND papel = 'advogado_responsavel'
        AND status = 'ativo'
    );

-- 2. monitoramento_snapshots: usar current_campanha_id() para filtrar por status ativo
DROP POLICY IF EXISTS "snapshot_select_campanha" ON monitoramento_snapshots;

CREATE POLICY snapshot_select_campanha ON monitoramento_snapshots
    FOR SELECT USING (campanha_id = current_campanha_id());
