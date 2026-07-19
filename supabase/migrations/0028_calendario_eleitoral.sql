-- Calendário eleitoral 2026 — prazos do TSE visíveis dentro do sistema.
-- (ref. specs.md [2026-07-19] "Calendário eleitoral com prazos TSE")
--
-- Segunda exceção deliberada ao isolamento por tenant (precedente: Código Eleitoral
-- compartilhado, migration 0024): o calendário é lei federal pública, idêntico pra
-- qualquer campanha — não há campanha_id. Leitura pra qualquer usuário interno ativo;
-- NENHUMA policy de escrita — conteúdo mantido por migration/seed, nunca pela aplicação.

CREATE TABLE prazos_eleitorais (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data       DATE NOT NULL,
    titulo     TEXT NOT NULL,
    descricao  TEXT,
    categoria  TEXT NOT NULL CHECK (categoria IN ('convencoes','registro','propaganda','financeiro','votacao','outro')),
    fonte      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prazos_eleitorais_data ON prazos_eleitorais (data);

ALTER TABLE prazos_eleitorais ENABLE ROW LEVEL SECURITY;
ALTER TABLE prazos_eleitorais FORCE ROW LEVEL SECURITY;

-- current_papel() já exige usuarios_internos.status = 'ativo' (migration 0023) —
-- usuário revogado não passa por aqui, mesmo com sessão válida.
CREATE POLICY prazos_eleitorais_select ON prazos_eleitorais
    FOR SELECT USING (current_papel() IS NOT NULL);

GRANT SELECT ON prazos_eleitorais TO authenticated;
REVOKE ALL ON prazos_eleitorais FROM anon;

-- Seed do calendário 2026.
-- Datas fixadas em lei entram com a fonte legal direta. Datas definidas pela resolução
-- anual do TSE estão marcadas "conferir" na descrição — critério de aceite da spec exige
-- conferência contra a Resolução oficial do Calendário Eleitoral 2026 antes do uso real.
INSERT INTO prazos_eleitorais (data, titulo, descricao, categoria, fonte) VALUES
  ('2026-07-20', 'Início das convenções partidárias',
   'Abertura do período para os partidos escolherem candidatos e deliberarem coligações.',
   'convencoes', 'Lei 9.504/1997, art. 8º'),
  ('2026-08-05', 'Fim do prazo para convenções partidárias',
   'Último dia para realização das convenções de escolha de candidatos.',
   'convencoes', 'Lei 9.504/1997, art. 8º'),
  ('2026-08-15', 'Prazo final para registro de candidaturas',
   'Registro no TSE/TREs até as 19h. Sem registro (ainda que sub judice), não há campanha.',
   'registro', 'Lei 9.504/1997, art. 11'),
  ('2026-08-16', 'Início da propaganda eleitoral',
   'A partir desta data é permitida a propaganda eleitoral, inclusive na internet. Antes disso, atos de propaganda antecipada são puníveis (art. 36-A delimita o que é lícito antes).',
   'propaganda', 'Lei 9.504/1997, art. 36'),
  ('2026-08-28', 'Início da propaganda gratuita em rádio e TV',
   'CONFERIR data exata na Resolução do Calendário Eleitoral 2026 antes de usar como referência operacional.',
   'propaganda', 'Resolução TSE — calendário eleitoral 2026'),
  ('2026-09-13', 'Prestação de contas parcial',
   'Envio da prestação de contas parcial ao TSE. CONFERIR data exata na Resolução do Calendário Eleitoral 2026.',
   'financeiro', 'Resolução TSE — calendário eleitoral 2026'),
  ('2026-10-01', 'Início da janela de vedação de conteúdo sintético (72h)',
   'A partir de 72h antes do 1º turno, é vedado publicar peça nova gerada/alterada significativamente por IA. O sistema já trava novas peças sintéticas automaticamente neste período.',
   'propaganda', 'Resolução TSE 23.732/2024'),
  ('2026-10-01', 'Fim da propaganda gratuita em rádio e TV',
   'CONFERIR data exata na Resolução do Calendário Eleitoral 2026.',
   'propaganda', 'Resolução TSE — calendário eleitoral 2026'),
  ('2026-10-04', 'Eleições 2026 — 1º turno',
   'Votação. Vedada propaganda no dia (boca de urna é crime, art. 39 §5º). Manifestação individual e silenciosa do eleitor é permitida.',
   'votacao', 'CF art. 77 / Lei 9.504/1997'),
  ('2026-10-25', 'Eleições 2026 — 2º turno (onde houver)',
   'Segundo turno para presidente e governadores, nos casos em que nenhum candidato atingir maioria absoluta no 1º turno.',
   'votacao', 'CF art. 77');
