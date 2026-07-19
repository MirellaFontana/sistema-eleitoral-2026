-- Remodelagem do campo — enums (ref. .pipeline/specs.md [2026-07-15] "Remodelagem do campo").
-- Só enums aqui: valores novos de enum não podem ser usados com segurança na mesma transação
-- em que são criados — as tabelas/policies que os usam vão na 0015 (mesmo padrão da dupla 0005/0006).

-- Nova porta de entrada de cidadão: formulário físico trazido por liderança, digitado pela equipe.
-- O enum continua fechado — a trava "nunca por importação/lista comprada" segue intacta.
ALTER TYPE origem_cadastro_cidadao ADD VALUE 'formulario_lideranca';

-- porta_a_porta exige geom da coleta (CHECK na 0001); formulário de papel digitado depois não tem.
ALTER TYPE canal_consentimento ADD VALUE 'formulario_fisico';

CREATE TYPE status_lideranca AS ENUM ('ativa', 'inativa');
CREATE TYPE tipo_meta AS ENUM ('lideranca', 'territorio', 'geral');
CREATE TYPE periodo_meta AS ENUM ('mensal', 'total');
CREATE TYPE status_tarefa AS ENUM ('a_fazer', 'em_progresso', 'concluida');
