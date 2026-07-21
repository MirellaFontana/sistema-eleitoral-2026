-- Aperfeiçoa Tarefas: adiciona descrição e troca "responsável" de texto livre pra referência
-- direta ao cadastro da equipe (usuarios_internos), selecionável por nome.
--
-- Decisão revertida em relação à migration 0015 (que documentava texto livre como escolha
-- deliberada, aceitando nome de time OU de pessoa) — pedido explícito do usuário agora é que
-- o responsável venha sempre do cadastro da equipe. Não há como migrar automaticamente os
-- valores de texto livre existentes (ex.: "Equipe campo") pra um usuário específico, então
-- responsavel_id nasce nulo pras tarefas já cadastradas — quem quiser reatribuir edita depois.

ALTER TABLE tarefas ADD COLUMN descricao TEXT;
ALTER TABLE tarefas ADD COLUMN responsavel_id UUID REFERENCES usuarios_internos(id);
ALTER TABLE tarefas DROP COLUMN responsavel;

CREATE INDEX idx_tarefas_responsavel ON tarefas (responsavel_id);
