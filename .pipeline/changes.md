# changes.md — Programador

Aqui o **Programador** registra o que foi efetivamente implementado para cada item de `specs.md`: arquivos tocados, decisões técnicas, desvios em relação à spec original (e por quê).

Formato sugerido por entrada:

```
## [data] Nome da tarefa (ref. specs.md)
- Arquivos alterados:
- Decisões técnicas:
- Desvios da spec:
- Pendências para o Testador:
```

---

## [2026-07-12] Módulo 1 — Schema base multitenant (ref. specs.md "Módulo 1 — Schema base multitenant")

- **Arquivos alterados:** `supabase/migrations/0001_modulo1_fundacao_seguranca.sql` (novo).

- **Decisões técnicas:**
  - Papéis, enums e nomes de tabela seguem a spec (campanhas, usuarios_internos, territorios, cidadaos, consentimentos_lgpd, log_auditoria), com valores de enum em snake_case (não os rótulos com acento/espaço do rascunho recebido) para casar com claims de JWT/código sem ambiguidade de escaping.
  - Isolamento por tenant via funções helper (`current_campanha_id()`, `current_papel()`, `current_territorio_id()`) que leem `usuarios_internos` por `auth.uid()`, em vez de depender de custom claims em `app_metadata` do JWT (exigiria configurar um Auth Hook à parte, dependência não montada ainda).
  - MFA obrigatório de coord_campanha checado via claim padrão do Supabase `aal = 'aal2'` (Authenticator Assurance Level), não via claim `amr` (que não é o mecanismo real do Supabase).
  - Trilha append-only (`log_auditoria`, `consentimentos_lgpd`) reforçada por **trigger** que bloqueia UPDATE/DELETE incondicionalmente, além de RLS e de grants sem UPDATE/DELETE — RLS sozinha não protege contra roles com BYPASSRLS (ex.: `service_role`/`postgres`).
  - `origem_cadastro` do cidadão é enum fechado (`enquete`, `demanda`, `app`, `embaixador`) em vez de CHECK com lista — não existe valor possível para "importação"/"digitação em massa", a trava é estrutural.
  - `whatsapp TEXT` com `UNIQUE(campanha_id, whatsapp)` em vez do `contato jsonb` original da spec — simplificação aceita para permitir dedup real do cidadão dentro da campanha.

- **Desvios da spec (e por quê):**
  1. **Bug corrigido em relação ao rascunho SQL recebido do usuário no meio da tarefa:** o rascunho definia 3 policies permissivas separadas em `cidadaos` (`camp_isolation`, `advogado_restrito`, `mfa_requirement`). No Postgres, policies permissivas do mesmo comando são combinadas com **OR**, não AND — isso anularia o isolamento multitenant (qualquer usuário não-advogado veria cidadão de qualquer campanha). Corrigido consolidando as condições numa única policy por comando (`cidadaos_select`, etc.), com todas as restrições em AND dentro do mesmo USING/WITH CHECK.
  2. Adicionadas policies para `campanhas`, `usuarios_internos`, `territorios` e `log_auditoria` — o rascunho só cobria `cidadaos`; sem policy nas demais, RLS habilitada = acesso zero (funcionalmente quebrado, embora não inseguro).
  3. Adicionado `origem_cadastro` e `embaixador_coletor_id` em `cidadaos` — ausentes no rascunho, mas são a garantia estrutural da regra "cidadão nunca entra por digitação/importação" (CLAUDE.md).
  4. `consentimentos_lgpd` ampliada com `finalidade`, `base_legal`, `texto_aceito`, `canal_origem`, `status`, `geom_coleta` (com CHECK de geo obrigatória para porta a porta) — o rascunho só tinha `origem_coleta` e `ip_origem`, insuficiente para a exigência de consentimento granular/revogável da LGPD.
  5. Removido o estágio de funil "Conversão" sugerido informalmente — a especificação (docs/especificacao-v1.md) e a spec aprovada definem 4 estágios (atração/interação/ativação/advocacia). Se "Conversão" for necessário, é uma mudança de escopo a aprovar antes, não uma implementação silenciosa.
  6. `FORCE ROW LEVEL SECURITY` aplicada em todas as tabelas por disciplina de defesa em profundidade, com nota de que não afeta roles com BYPASSRLS (ex.: `postgres` no Supabase) — RLS não é suficiente sozinha para o append-only, daí os triggers do item de decisões técnicas.

- **Pendências para o Testador:**
  - Confirmar que RLS aplicada com 2 campanhas fake + usuários fake de cada papel não permite nenhum cruzamento cross-tenant (SELECT/INSERT/UPDATE).
  - Confirmar que embaixador não lê/escreve cidadão fora do próprio território.
  - Confirmar que advogado e candidato recebem 0 linhas em SELECT de `cidadaos` e `consentimentos_lgpd`.
  - Confirmar que UPDATE/DELETE em `log_auditoria` e `consentimentos_lgpd` falha (trigger) mesmo autenticado como `postgres`/`service_role`.
  - Confirmar que inserir `cidadaos` com `origem_cadastro='embaixador'` sem `embaixador_coletor_id` falha no CHECK.
  - Extensão PostGIS e Supabase Auth devem estar habilitados no projeto antes de aplicar esta migration (dependência já registrada em specs.md).

---

## [2026-07-12] Fix pós-teste — coord_comunicacao via PII de cidadão (ref. results.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0001_modulo1_fundacao_seguranca.sql`.
- **Decisão técnica:** `cidadaos_select` e `consentimentos_select` excluíam `advogado` e `candidato` do `NOT IN`, mas não `coord_comunicacao` — que pela especificação §3.2 também não deve acessar dado pessoal de cidadão ("Coord. de comunicação: Alertas de ameaça, peças de conteúdo, status de rotulagem" / "Não acessa: Dado pessoal de cidadão"). Adicionado `coord_comunicacao` ao `NOT IN` das duas policies.
- **Desvio da spec:** nenhum — é correção de um desvio não intencional introduzido na implementação anterior, encontrado pelo Testador no traço manual do teste 2c (bonus).
- **Pendências para o Testador:** revalidar teste 2c com a policy corrigida.

---

## [2026-07-13] Fix pós-teste real — anon com grant total nas tabelas sensíveis (ref. results.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0002_revoke_anon_grants.sql` (novo), `.pipeline/rls_smoke_test.sql` (novo, script de teste real reutilizável).
- **Decisão técnica:** o Testador rodou os 5 testes do plano pela primeira vez contra Postgres real (Supabase staging), em vez de traço manual, e achou que `anon` tinha SELECT/INSERT/UPDATE/DELETE/TRUNCATE em todas as tabelas — vindo de `ALTER DEFAULT PRIVILEGES` que o próprio Supabase configura em todo projeto novo para as roles `postgres`/`supabase_admin`, concedendo tudo a `anon`/`authenticated`/`service_role` por padrão. A migration 0001 apostou em "não conceder = sem acesso", o que é falso nesta plataforma. `0002` faz `REVOKE ALL` explícito de `anon` nas 6 tabelas, e também de `authenticated` (seguido de `GRANT` só do necessário), fechando a segunda camada de defesa que faltava (RLS sozinha já bloqueava na prática, mas não deveria ser a única linha).
- **Desvio da spec:** nenhum — é hardening que a spec já pedia implicitamente ("anon não recebe grant nenhum", §RLS da migration 0001); só não tinha sido validado contra a plataforma real até agora.
- **Pendências para o Testador:** nenhuma — retestado na mesma sessão, 13/13 passou incluindo o caso do `anon`.

---
