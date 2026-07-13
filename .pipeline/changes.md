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

## [2026-07-13] Base de conhecimento da campanha — migration 0004 (temas + itens + Storage)

- **Arquivos alterados:** `supabase/migrations/0004_base_conhecimento.sql` (novo), `.pipeline/base_conhecimento_test.sql` (novo).
- **Decisão técnica:** `coord_comunicacao` tem INSERT/UPDATE aqui (diferente do padrão de PII de cidadão, onde esse papel só lê) — decisão explícita do usuário, é quem mais alimenta essa base. Storage usa bucket privado `base-conhecimento` com policies em `storage.objects` que reaproveitam `current_campanha_id()`/`current_papel()` já testados, filtrando pelo primeiro segmento do path (`storage.foldername(name)[1]`).
- **Testado real (8/8):** isolamento cross-tenant, coord_comunicacao cria item (positivo), embaixador não cria mas lê (dois testes), CHECK descricao-ou-arquivo, storage insert dentro da própria pasta (positivo), storage bloqueado cross-tenant, storage bloqueado por papel sem permissão.
- **Nota de teste:** não deu pra limpar 100% a fixture de Storage — a role de conexão da Management API não é dona de `storage.objects` pra desabilitar o trigger `protect_objects_delete` (só permite DELETE via Storage API). Ficou 1 linha de metadado órfã no bucket de staging (sem arquivo binário real por trás, não referencia campanha nenhuma existente) — sem custo prático, registrado aqui em vez de escondido.
- **Desvio da spec:** nenhum.
- **Pendências para o Testador:** nenhuma.

---

## [2026-07-13] Tela de base de conhecimento (Next.js) — testada no navegador

- **Arquivos alterados:** `apps/web/app/base-conhecimento/` (page, TemaForm, ItemForm, DownloadButton), `components/AppHeader.tsx` (nav entre Usuários e Base de conhecimento).
- **Testado real no navegador:** criação de tema, item só com descrição, item com upload de PDF real (via chamada de script equivalente à do formulário, já que este navegador de teste não consegue dirigir o seletor nativo de arquivo do SO) + geração de signed URL de download — tudo contra o Supabase de staging.
- **Bug real achado e corrigido:** `ItemForm` inicializava `temaId` com `useState(temas[0]?.id ?? "")`; como o componente monta antes de existir tema nenhum (primeira visita à página), esse estado ficava travado em `""` mesmo depois de um tema ser criado (React não reprocessa o valor inicial do `useState` quando as props mudam). Corrigido com `useEffect` que resincroniza `temaId` quando `temas` muda.
- **Limitação de teste registrada, não do app:** não foi possível clicar num `<input type="file">` real neste navegador de teste (bloqueio de segurança do próprio browser contra preenchimento programático) — o caminho de upload foi validado chamando `supabase.storage.upload()` diretamente com um `File` construído em memória, mesmo método usado pelo componente real.
- **Desvio da spec:** nenhum.
- **Pendências para o Testador:** confirmar upload via clique real de usuário (fora do alcance desta sessão de teste automatizado).

---

## [2026-07-13] Hierarquia de papéis — migrations 0005 (enum) + 0006 (policies)

- **Arquivos alterados:** `supabase/migrations/0005_papeis_hierarquia_enum.sql`, `0006_papeis_hierarquia_policies.sql`, `.pipeline/hierarquia_test.sql` (novo).
- **Decisão do usuário (ref. specs.md):** candidato sobe pra leitura total (inclusive PII de cidadão), sem poder administrativo. `advogado`→`advogado_responsavel` (+ novo `assistente_juridico`), `coord_comunicacao`→`coord_marketing` (+ novo `redator_marketing`). Renomeado via `ALTER TYPE ... RENAME VALUE` (preserva usuários já cadastrados), não recriado do zero.
- **Testado real (9/9):** candidato lê cidadaos/log_auditoria (positivo), candidato sem poder em usuarios_internos/campanhas (negativo), advogado_responsavel/assistente_juridico sem PII mas com leitura de auditoria, coord_marketing edita base de conhecimento (renomeado), redator_marketing só lê (não edita).
- **Bug de teste encontrado e corrigido (não é bug de segurança):** o teste 4 (candidato não pode UPDATE em campanhas) deu falso positivo na primeira rodada — `UPDATE` bloqueado por RLS não gera exceção, só afeta 0 linhas silenciosamente. Conferi o valor real da coluna depois do UPDATE (`debug_candidato2.sql`, fora do pipeline principal): não mudou. Corrigi o teste pra usar `GET DIAGNOSTICS ... ROW_COUNT` em vez de só checar ausência de erro. A policy sempre esteve correta; o teste que estava errado.
- **Desvio da spec:** nenhum (a mudança de acesso do candidato já é a spec, documentada antes do código).
- **Pendências:** frontend (`InviteUserForm`, `usuarios/page.tsx`, `base-conhecimento/page.tsx`) ainda referencia os nomes antigos de papel (`advogado`, `coord_comunicacao`) — próximo passo antes de considerar isso fechado.

---

## [2026-07-13] Frontend atualizado pra hierarquia de papéis nova

- **Arquivos alterados:** `InviteUserForm.tsx`, `usuarios/page.tsx`, `base-conhecimento/page.tsx` — labels e listas de papel trocados pros nomes novos (`advogado_responsavel`, `assistente_juridico`, `coord_marketing`, `redator_marketing`).
- **Testado no navegador:** dropdown de convite mostra os 7 papéis corretos; convite de um `redator_marketing` de verdade funcionou (achei e descartei um falso alarme — clique em `ref` desatualizado após o layout mudar, não bug do app).
- **Pendências:** nenhuma.

---

## [2026-07-13] Monitoramento (clipping) — migration 0007

- **Arquivos alterados:** `supabase/migrations/0007_monitoramento.sql` (novo), `.pipeline/monitoramento_test.sql` (novo).
- **Decisão técnica:** um único ponto de entrada (`monitoramento_itens`) pra ameaça jurídica, deepfake suspeito, menção neutra ou oportunidade de marketing — classificado por `categoria`, não separado em tabelas por módulo. Leitura liberada a todos os papéis internos (inclusive embaixador/candidato); criação restrita a quem trabalha o conteúdo (`coord_campanha`, `advogado_responsavel`, `assistente_juridico`, `coord_marketing`, `redator_marketing`) — embaixador (papel de campo) e candidato (só leitura, decisão já registrada) ficam de fora da criação.
- **Testado real (7/7):** criação pelo papel liberado, bloqueio de embaixador e candidato na criação, leitura liberada pros dois, isolamento cross-tenant, storage (bucket `monitoramento`) liberado pro papel certo e bloqueado pro embaixador.
- **Desvio da spec:** nenhum.
- **Pendências:** frontend (`/monitoramento`) ainda não construído — próximo passo.

---
