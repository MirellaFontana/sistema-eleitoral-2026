-- Amplia as categorias de monitoramento (ref. specs.md [2026-07-13] "Categorias de monitoramento").
-- Puramente aditivo — categoria não é referenciada em nenhuma policy, sem impacto de RLS.
ALTER TYPE categoria_monitoramento ADD VALUE 'gestao_crise';
ALTER TYPE categoria_monitoramento ADD VALUE 'mencao_positiva';
ALTER TYPE categoria_monitoramento ADD VALUE 'mencao_negativa';
