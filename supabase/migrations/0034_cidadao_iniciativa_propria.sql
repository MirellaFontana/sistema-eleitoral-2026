-- Cadastro de eleitor deixa de exigir liderança — pode vir por iniciativa própria da pessoa,
-- sem ter sido trazido por formulário físico de campo. A trava de banco já era condicional
-- (formulario_lideranca_exige_lideranca, migration 0015: só exige lideranca_id quando
-- origem_cadastro = 'formulario_lideranca') — o bloqueio real estava só no frontend, que
-- hardcodava origem_cadastro e tornava liderança obrigatória na tela.

ALTER TYPE origem_cadastro_cidadao ADD VALUE IF NOT EXISTS 'iniciativa_propria';
