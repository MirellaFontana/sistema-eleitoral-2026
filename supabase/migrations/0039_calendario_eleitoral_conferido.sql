-- Conferência das datas do calendário eleitoral contra a Resolução TSE nº 23.760/2026.
-- Remove marcações "CONFERIR" das descrições e atualiza fonte para a resolução oficial.
-- Adiciona datas relevantes que faltavam no seed original.

-- 1. Atualizar propaganda rádio/TV início (28/08) — data confirmada
UPDATE prazos_eleitorais
SET descricao = 'Início da veiculação do horário eleitoral gratuito em rádio e TV para o 1º turno. Vai até 1º de outubro.',
    fonte = 'Resolução TSE nº 23.760/2026'
WHERE data = '2026-08-28' AND categoria = 'propaganda';

-- 2. Atualizar prestação de contas parcial (13/09) — data confirmada
UPDATE prazos_eleitorais
SET descricao = 'Último dia para envio da prestação de contas parcial à Justiça Eleitoral, com movimentação financeira desde o início da campanha até 08/09/2026.',
    fonte = 'Resolução TSE nº 23.760/2026, art. 47 da Res. 23.607/2019'
WHERE data = '2026-09-13' AND categoria = 'financeiro';

-- 3. Atualizar fim propaganda rádio/TV (01/10) — data confirmada
UPDATE prazos_eleitorais
SET descricao = 'Último dia de veiculação do horário eleitoral gratuito em rádio e TV para o 1º turno.',
    fonte = 'Resolução TSE nº 23.760/2026'
WHERE data = '2026-10-01' AND categoria = 'propaganda' AND titulo LIKE '%rádio%';

-- 4. Adicionar datas que faltavam

-- Fechamento do cadastro eleitoral
INSERT INTO prazos_eleitorais (data, titulo, descricao, categoria, fonte) VALUES
  ('2026-05-07', 'Fechamento do cadastro eleitoral',
   'Último dia para solicitar título, transferir domicílio eleitoral ou realizar revisão cadastral. Após esta data, o cadastro fica fechado até após as eleições.',
   'registro', 'Resolução TSE nº 23.760/2026');

-- Início do envio de dados financeiros (72h)
INSERT INTO prazos_eleitorais (data, titulo, descricao, categoria, fonte) VALUES
  ('2026-07-20', 'Início da obrigação de informar recursos financeiros',
   'A partir desta data, partidos e candidatos devem enviar à Justiça Eleitoral dados sobre recursos financeiros recebidos para campanha, no prazo de 72 horas do recebimento.',
   'financeiro', 'Resolução TSE nº 23.760/2026, Lei 9.504/1997 art. 28 §4º');

-- Propaganda rádio/TV 2º turno
INSERT INTO prazos_eleitorais (data, titulo, descricao, categoria, fonte) VALUES
  ('2026-10-09', 'Início da propaganda gratuita em rádio e TV — 2º turno',
   'Início da veiculação do horário eleitoral gratuito para o 2º turno (onde houver). Vai até 23 de outubro.',
   'propaganda', 'Resolução TSE nº 23.760/2026'),
  ('2026-10-23', 'Fim da propaganda gratuita em rádio e TV — 2º turno',
   'Último dia de veiculação do horário eleitoral gratuito para o 2º turno.',
   'propaganda', 'Resolução TSE nº 23.760/2026');
