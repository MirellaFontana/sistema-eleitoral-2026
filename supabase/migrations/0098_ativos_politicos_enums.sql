-- Ativos Políticos — enums (mesma razão da dupla 0014/0015: valores novos de enum
-- não podem ser usados com segurança na mesma transação em que são criados).

CREATE TYPE nivel_influencia_ativo AS ENUM (
    'muito_alto', 'alto', 'medio', 'baixo', 'nao_avaliado'
);

CREATE TYPE abrangencia_ativo AS ENUM (
    'local', 'municipal', 'regional', 'estadual', 'nacional'
);

CREATE TYPE status_relacionamento_ativo AS ENUM (
    'nao_relacionado', 'identificado', 'contato_realizado',
    'relacionamento_ativo', 'parceiro', 'em_avaliacao', 'inativo'
);

-- Novas permissões delegáveis
ALTER TYPE permissao_sistema ADD VALUE 'ver_ativos_politicos';
ALTER TYPE permissao_sistema ADD VALUE 'gerenciar_ativos_politicos';
