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

## [2026-07-13] Migration 0003 — bootstrap_campanha (ref. specs.md "bug de bootstrap")

- **Arquivos alterados:** `supabase/migrations/0003_bootstrap_campanha.sql` (novo), `.pipeline/bootstrap_test.sql` (novo).
- **Decisão técnica:** função `SECURITY DEFINER` única resolve o ovo-e-galinha (ninguém consegue criar a primeira campanha/coord_campanha via RLS normal). Controle de quem pode criar tenant fica centralizado na função (checa `auth.uid()` ainda não estar em `usuarios_internos`), não numa policy de INSERT permanente em `campanhas` — evita abrir uma porta que ficaria aberta pra sempre.
- **Testado (real, contra staging):** 3/3 — cria campanha+coord_campanha; segunda chamada do mesmo usuário bloqueada; `anon` sem EXECUTE na função.
- **Desvio da spec:** nenhum — é a resolução da dependência já registrada na spec antes do código ser escrito.
- **Pendências para o Testador:** nenhuma.

---

## [2026-07-13] Telas de cadastro (Next.js) + MFA — testado no navegador de ponta a ponta

- **Arquivos alterados:** `apps/web/` (scaffold Next.js completo — login, signup, onboarding, usuários, território, convite, MFA enroll/verify), `lib/supabase/{client,server}.ts`, `middleware.ts`, `lib/mfa.ts`, `app/api/usuarios/invite/route.ts`.
- **Decisão técnica:** convite de usuário faz a criação da conta de auth via `service_role` (só possível server-side, num Route Handler), mas o INSERT em `usuarios_internos` roda pela sessão de quem convidou — a RLS já testada no Módulo 1 continua sendo o que decide se o INSERT vale, não o Route Handler.
- **Testado de verdade no navegador (não só lido o código)** — 5 bugs reais encontrados e corrigidos nesta mesma sessão:
  1. `TerritorioForm` não enviava `campanha_id` no INSERT → RLS rejeitava (corrigido: campanha_id vem como prop do server component).
  2. Convite de usuário bloqueado pela policy `usuarios_internos_insert` (exige `mfa_verificado()`), porque MFA ainda não existia → motivou construir `/mfa/enroll` e `/mfa/verify` (TOTP) nesta mesma entrega, por decisão do usuário.
  3. `qr_code` do `mfa.enroll()` já vem como data URI pronta (`data:image/svg+xml;utf-8,...`), não como markup SVG cru — `dangerouslySetInnerHTML` estava errado, corrigido pra `<img src=...>`.
  4. `listFactors().data.totp` só retorna fatores **verificados** (confirmado na tipagem do SDK) — a limpeza de fatores não confirmados usava esse campo e nunca rodava, acumulando fatores órfãos. Corrigido pra usar `data.all` filtrado por `factor_type==='totp' && status==='unverified'`.
  5. Data de expiração exibida um dia antes do real (`31/12` virava `30/12`) — `toLocaleDateString` sem fuso aplicava o fuso local a uma data UTC. Corrigido fixando `timeZone:"UTC"` na formatação (campo é data pura, sem hora).
- **Também fixado:** `mailer_autoconfirm` ligado no projeto de staging (config de Auth, não código) — o tier free tem rate limit de e-mail muito baixo, travava o teste de signup.
- **Desvio da spec:** nenhum além do MFA (já registrado em specs.md como decisão do usuário).
- **Pendências para o Testador:** nenhuma pendência bloqueante; ambiente segue rodando localmente (`npm run dev` em `apps/web`) pra continuidade.

---
