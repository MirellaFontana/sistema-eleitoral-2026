-- A policy cidadaos_insert_formulario (migration 0001) só permite INSERT com
-- origem_cadastro = 'formulario_lideranca' e lideranca_id existente — não havia nenhuma policy
-- que permitisse coord_campanha inserir eleitor com a nova origem 'iniciativa_propria'
-- (adicionada na migration 0034). Sem esta policy, o INSERT era barrado pela RLS mesmo com o
-- frontend e o CHECK de tabela já ajustados.
--
-- Enum 'iniciativa_propria' precisa estar em migration separada e já commitada (0034) antes de
-- ser referenciado aqui — Postgres não permite usar um valor de enum recém-criado na mesma
-- transação em que foi adicionado.

CREATE POLICY cidadaos_insert_iniciativa_propria ON cidadaos
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() = 'coord_campanha'
        AND origem_cadastro = 'iniciativa_propria'
        AND lideranca_id IS NULL
    );
