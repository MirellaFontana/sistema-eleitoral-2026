-- Fix pós-teste real (ref. .pipeline/results.md — teste bônus "anon sem GRANT" reprovado).
--
-- Causa raiz: o Supabase define ALTER DEFAULT PRIVILEGES em `public` para as roles postgres/
-- supabase_admin que concedem TODOS os privilégios (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/...)
-- a anon, authenticated e service_role em toda tabela nova — isso é bootstrap da plataforma,
-- não algo criado pela migration 0001. A ausência de GRANT explícito não é suficiente como
-- controle: o RLS segurou nos testes (0 linhas visíveis), mas a tabela ficou sem a segunda
-- camada de defesa (grant), dependendo 100% da policy nunca ter um bug. Falha nesse padrão já
-- aconteceu uma vez neste mesmo módulo (coord_comunicacao, ver changes.md).
--
-- anon nunca deve ter acesso a nenhuma tabela sensível: captação de cidadão passa por função
-- SECURITY DEFINER dedicada (fora desta migration), nunca por acesso direto à tabela.
REVOKE ALL ON campanhas, usuarios_internos, territorios, cidadaos, consentimentos_lgpd, log_auditoria
    FROM anon;

-- authenticated também recebeu DELETE/TRUNCATE/REFERENCES/TRIGGER via default privilege, além do
-- SELECT/INSERT/UPDATE que a migration 0001 já concedia de propósito. RLS bloqueia (sem policy de
-- DELETE em nenhuma tabela), mas por princípio de menor privilégio o grant não deveria existir.
REVOKE ALL ON campanhas, usuarios_internos, territorios, cidadaos, consentimentos_lgpd, log_auditoria
    FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON campanhas, usuarios_internos, territorios, cidadaos TO authenticated;
GRANT SELECT, INSERT ON consentimentos_lgpd, log_auditoria TO authenticated;
