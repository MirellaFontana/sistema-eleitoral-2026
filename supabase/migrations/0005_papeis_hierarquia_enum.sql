-- Hierarquia de papéis (ref. specs.md [2026-07-13] "Reorganização de módulos + hierarquia de papéis").
-- Só o enum aqui — ADD VALUE não pode ser usado com segurança na mesma transação em que é criado
-- em versões mais antigas do Postgres, então as policies que passam a usar os valores novos vão
-- pra uma migration separada (0006).

ALTER TYPE papel_usuario RENAME VALUE 'coord_comunicacao' TO 'coord_marketing';
ALTER TYPE papel_usuario RENAME VALUE 'advogado' TO 'advogado_responsavel';
ALTER TYPE papel_usuario ADD VALUE 'assistente_juridico';
ALTER TYPE papel_usuario ADD VALUE 'redator_marketing';
