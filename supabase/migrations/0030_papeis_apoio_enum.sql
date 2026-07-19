-- Três papéis de apoio novos, pedidos pelo usuário: apoio_marketing (vê tudo relacionado a
-- marketing: monitoramento, peças, textos/sugestões, respostas, mensagens — sem PII nominal de
-- eleitor), apoio_campanha e apoio_coordenacao (por enquanto, mesmo acesso operacional geral
-- que embaixador/candidato já têm hoje — sem PII nominal de eleitor).
--
-- Enum-only nesta migration (mesmo padrão já usado em 0005+0006 e 0014+0015): Postgres não
-- permite usar um valor de enum recém-criado na mesma transação em que ele foi adicionado.
-- As policies que usam esses valores (cidadaos/consentimentos/mensagens) ficam na próxima
-- migration (0031).

ALTER TYPE papel_usuario ADD VALUE IF NOT EXISTS 'apoio_marketing';
ALTER TYPE papel_usuario ADD VALUE IF NOT EXISTS 'apoio_campanha';
ALTER TYPE papel_usuario ADD VALUE IF NOT EXISTS 'apoio_coordenacao';
