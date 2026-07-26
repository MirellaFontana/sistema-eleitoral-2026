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

## [2026-07-13] Editar/excluir item + múltiplos arquivos — migration 0009

- **Arquivos alterados:** `supabase/migrations/0009_base_conhecimento_arquivos.sql` (novo), `.pipeline/base_conhecimento_arquivos_test.sql` (novo).
- **Achado ao planejar:** usuário testou anexar "Código eleitoral" só com descrição, quis depois anexar o PDF — não dava, só criar item novo. "Complementar" (confirmado com o usuário) = item aceita **vários arquivos**, não é troca de arquivo único.
- **Decisão técnica:** `arquivo_path`/`arquivo_nome_original` saem de `base_conhecimento_itens` e viram tabela própria `base_conhecimento_arquivos` (item → muitos arquivos, `ON DELETE CASCADE`). CHECK `descricao_ou_arquivo` removida do banco (não dá pra checar "existe filho" com CHECK simples) — validação de "descrição ou arquivo" volta a ser só de UI. Dado existente (Biografia PDF) migrado antes de dropar as colunas — conferido sem perda.
- **Testado real (7/7):** editar item (positivo), embaixador não edita, múltiplos arquivos no mesmo item, embaixador não adiciona arquivo, isolamento cross-tenant, remover 1 arquivo mantendo o outro, excluir item cascateia os arquivos.
- **Desvio da spec:** nenhum.
- **Pendências:** frontend (edição/exclusão de item, múltiplos arquivos) ainda não construído — próximo passo.

---

## [2026-07-13] Frontend — editar/excluir item + múltiplos arquivos + confirmação sem dialog nativo

- **Arquivos alterados:** `ItemCard.tsx` (novo — edição inline, exclusão, lista de arquivos com remoção individual, upload de arquivo adicional), `ItemForm.tsx` (upload agora insere em `base_conhecimento_arquivos` depois de criar o item, não mais coluna direta), `page.tsx` (busca `base_conhecimento_arquivos` separado e agrupa por item), `DownloadButton.tsx` removido (órfão, substituído pelo botão de baixar dentro do `ItemCard`).
- **Bug real achado testando no navegador:** usei `window.confirm()` pra "excluir item"/"remover arquivo" — trava a ferramenta de automação de teste (diálogo nativo bloqueia o processo) e é UX inconsistente entre navegadores de qualquer forma. Substituído por confirmação inline (clique em "Excluir" mostra "Confirmar/Cancelar" no lugar, sem diálogo bloqueante).
- **Testado no navegador, com o item real do usuário:** editei a descrição do item "Código eleitoral" dele, anexei um PDF (`lei-9504-1997.pdf`, via upload real simulado — mesma limitação de sempre pra clicar em `<input type=file>` nativo), testei excluir um item de teste meu (funcionou, confirmação inline sem travar).
- **Desvio da spec:** nenhum.
- **Pendências:** nenhuma.

---

## [2026-07-13] Concorrentes + Demandas observadas — migration 0010

- **Arquivos alterados:** `supabase/migrations/0010_concorrentes_demandas.sql` (novo), `.pipeline/concorrentes_demandas_test.sql` (novo).
- **Nota de ambiente:** Bash (via harness) parou de resolver PATH pra binários externos nesta sessão (ls/node/npx sumiram, só builtins funcionavam) — segui usando PowerShell pro resto da sessão, sem impacto no resultado.
- **Decisão técnica:** `demandas_observadas` (não `demandas`) — nome deliberado pra não colidir com o futuro módulo formal de cidadão-relata/mandato-encaminha já previsto na especificação original. É nota de referência regional (região, cidade, tema, demanda), confirmado com o usuário.
- **Testado real (7/7):** criação pelo papel liberado em ambas as tabelas, bloqueio de embaixador na criação de ambas, leitura liberada (embaixador lê concorrentes), isolamento cross-tenant nas duas.
- **Desvio da spec:** nenhum.
- **Pendências:** frontend ainda não construído; tema "Atual Conjuntura" ainda não criado.

---

## [2026-07-15] Conteúdo real: 2 PDFs do Código Eleitoral cadastrados

- **Não é mudança de schema/código** — é dado real cadastrado na campanha de staging, registrado aqui pelo mesmo padrão de rastreabilidade dos outros itens.
- Usuário forneceu 2 PDFs (`Codigo_Eleitoral_2026_SEPRev30_OK__1_.pdf`, 1347 páginas, TSE 2026; `Codigo_eleitoral.pdf`, 130 páginas, Lei 4.737/1965 atualizada até abril/2023) pra virarem a base de conhecimento de legislação.
- Upload direto pro Storage via API (service_role, escopo pontual) + insert nas tabelas via `.pipeline/seed_codigo_eleitoral.sql`, já que não dá pra dirigir o seletor nativo de arquivo do navegador nesta sessão de automação — mesmo padrão usado em testes anteriores.
- Verificado: tamanho do arquivo no Storage bate exatamente com o original (9.476.313 bytes), item aparece corretamente na tela com o título e descrição certos.
- **Pendência de sessão, não do produto:** a sessão MFA da conta de teste expirou entre turnos — precisei reconfirmar (mesmo padrão de sempre, secret já estava salvo no banco de staging desde o enrollment).

---

## [2026-07-15] Módulo 4 — Marketing: schema (migration 0011)

- **Arquivos alterados:** `supabase/migrations/0011_marketing_ia.sql` (novo), `.pipeline/marketing_ia_test.sql` (novo).
- **Decisão técnica:** `sugestoes_conteudo`/`analises_campanha` sem policy de UPDATE/DELETE de propósito — é histórico de auditoria de chamada de IA, não deveria ser editável por ninguém. `faqs` é a única tabela deste módulo onde `redator_marketing` tem poder de escrita igual a `coord_marketing` (diferente do padrão da base de conhecimento).
- **Testado real (7/7):** FAQ criada pelo papel liberado e lida por todos, embaixador bloqueado de criar FAQ/sugestão em ambas, sugestão de conteúdo e análise de campanha criadas pelos papéis certos, isolamento cross-tenant nas 3 tabelas.
- **Desvio da spec:** nenhum.
- **Pendências:** frontend (telas de FAQ, geração de sugestão, análise de pontos cegos) e a integração real com a API da Anthropic — bloqueada até o usuário fornecer a API key.

---

## [2026-07-15] Módulo 4 — Marketing: frontend + rotas de IA

- **Arquivos alterados:** `lib/anthropic.ts` (client + prompts de sistema), `app/api/marketing/sugestao/route.ts`, `app/api/marketing/analise/route.ts`, `app/marketing/` (page + FaqForm + SugestaoForm + AnaliseButton), nav no `AppHeader`.
- **Decisão técnica:** rotas retornam erro 400 com mensagem amigável quando `ANTHROPIC_API_KEY` não está configurada (`createAnthropicClient()` retorna `null` em vez de lançar erro de SDK) — permite testar toda a UI/permissão/persistência sem a key.
- **Testado no navegador (sem API key ainda):** FAQ criada de ponta a ponta (insert real, aparece na lista). Botão "Analisar pontos cegos" dispara a rota de verdade, recebe 400, mostra a mensagem amigável na tela — confirma autenticação/autorização e o caminho de erro, só falta a geração de verdade.
- **Desvio da spec:** nenhum.
- **Pendências:** ligar a geração real assim que o usuário fornecer `ANTHROPIC_API_KEY`.

---

## [2026-07-13] Monitoramento (clipping) — migration 0007

- **Arquivos alterados:** `supabase/migrations/0007_monitoramento.sql` (novo), `.pipeline/monitoramento_test.sql` (novo).
- **Decisão técnica:** um único ponto de entrada (`monitoramento_itens`) pra ameaça jurídica, deepfake suspeito, menção neutra ou oportunidade de marketing — classificado por `categoria`, não separado em tabelas por módulo. Leitura liberada a todos os papéis internos (inclusive embaixador/candidato); criação restrita a quem trabalha o conteúdo (`coord_campanha`, `advogado_responsavel`, `assistente_juridico`, `coord_marketing`, `redator_marketing`) — embaixador (papel de campo) e candidato (só leitura, decisão já registrada) ficam de fora da criação.
- **Testado real (7/7):** criação pelo papel liberado, bloqueio de embaixador e candidato na criação, leitura liberada pros dois, isolamento cross-tenant, storage (bucket `monitoramento`) liberado pro papel certo e bloqueado pro embaixador.
- **Desvio da spec:** nenhum.
- **Pendências:** frontend (`/monitoramento`) ainda não construído — próximo passo.

---

## [2026-07-15] Módulo 3 — Jurídico: Conformidade e rotulagem IA — migration 0012 + frontend (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0012_pecas_conteudo.sql` (novo), `.pipeline/pecas_conteudo_test.sql` (novo), `apps/web/app/pecas-conteudo/{page.tsx,PecaForm.tsx,PecaCard.tsx}` (novo), `components/AppHeader.tsx` (nav).
- **Decisões técnicas:**
  - Travas de rotulagem/aprovação (`publicacao_ia_exige_rotulo`, `publicacao_exige_aprovador`) são CHECK constraints simples (só olham colunas da própria linha) — mais barato e mais difícil de contornar do que trigger, para essa parte.
  - Janela de bloqueio (`dentro_janela_bloqueio()`) é função `STABLE` com constante fixa (`2026-10-01` a `2026-10-05`, horário de Brasília) mais um trigger `BEFORE INSERT OR UPDATE`, porque `now()` não é imutável e não pode entrar num CHECK simples — e a lógica de "só bloqueia peça nova/publicação nova, não afeta peça já publicada antes" precisa comparar `OLD.status` vs `NEW.status`, que CHECK não enxerga.
  - Separação de poder (autor não pode auto-aprovar) não dá para expressar só com RLS de linha (RLS não distingue quais colunas mudaram dentro do mesmo UPDATE) — reforçada por trigger (`restringir_aprovacao_pecas_conteudo`) que compara `OLD`/`NEW` campo a campo. Mesmo trigger garante `aprovador_id = auth.uid()` (ninguém assina aprovação em nome de outro usuário) — não estava no critério original de aceite, adicionado por ser barato e fechar um buraco óbvio de integridade.
  - `coord_marketing` entra no grupo de aprovação (decisão do usuário, diferente da minha proposta inicial de só jurídico + coord_campanha) — refletido em RLS, trigger e frontend.
  - Sem policy de DELETE (nem no schema, nem pedido pelo usuário) — peça de conteúdo, mesmo descartada, pode compor dossiê de defesa depois; "descartar" vira só um status, não uma remoção de linha.
- **Frontend:** decisão do usuário de incluir junto nesta entrega (desviando do padrão dos módulos anteriores, que faziam schema primeiro e frontend depois). `PecaCard` usa confirmação inline pra aprovar (mesmo padrão anti-`window.confirm` já estabelecido em `base-conhecimento`), mostra o rótulo aplicado como banner visível, não só um campo de banco.
- **Testado real contra staging (12/12 via `supabase db query --linked`, não CLI local — Docker segue indisponível nesta máquina):** rascunho com IA, redator não auto-aprova (trigger), advogado aprova e publica (positivo), IA sem rótulo não publica (CHECK), rotulado sem aprovador não publica (CHECK), coord_marketing aprova peça sem IA (positivo, valida a decisão de incluí-lo), aprovador_id≠auth.uid() bloqueado, INSERT de peça IA bloqueado dentro da janela (forçada temporariamente via `CREATE OR REPLACE FUNCTION` e restaurada na mesma sessão — conferido depois que a função voltou ao texto original), peça sem IA não afetada pela janela, publicação de peça IA existente bloqueada dentro da janela, fora da janela o mesmo fluxo publica normalmente, isolamento cross-tenant.
- **Testado no navegador (dev local, contra staging):** criei dois usuários de teste extras via `service_role` (script temporário, apagado depois) — resetei senha do `redator_marketing` de teste já existente (`+redatorteste@gmail.com`) e criei um `advogado_responsavel` de teste novo (`+advogadoteste@gmail.com`), nenhum dos dois exige MFA, o que evitou depender do TOTP do `coord_campanha` de teste (cujo secret não estava disponível nesta sessão). Fluxo ponta a ponta real: `redator_marketing` cria rascunho com IA (vê form, não vê botão de aprovar) → `advogado_responsavel` vê "Aprovar e publicar", confirma com o texto de rótulo padrão pré-preenchido → peça vira "Publicado" com o rótulo em destaque e data de publicação. Peça de teste apagada do staging ao final (via `service_role`, já que não há policy de DELETE de propósito).
- **Nota de ambiente:** sem `psql`/Docker local disponíveis; execução real foi via `npx supabase db query --linked -f arquivo.sql` (subcomando `query` do CLI 2.109.1, não documentado nas sessões anteriores) — mais simples que o `DO $$...$$` manual via psql usado antes. Token de acesso pessoal fornecido pontualmente pelo usuário para esta sessão; recomendado revogar após o ciclo (mesmo padrão já registrado antes).
- **Desvio da spec:** nenhum — escopo e decisões batem com `.pipeline/specs.md` desta mesma data, já confirmado com o usuário antes da implementação.
- **Fora desta entrega (registrado, não esquecido):** escudo antideepfake (`evento_ameaca`) e matriz de alertas/encaminhamento formal (`alerta`) — partes 2 e 3 do bloco jurídico, specs seguintes. `sugestao_conteudo_id` (rastreabilidade com Módulo 4) existe no schema mas não está exposto no formulário ainda.
- **Pendências para o Testador:** nenhuma pendência bloqueante — já testado real (banco + navegador) nesta mesma entrada.

---

## [2026-07-15] Módulo 3 — Jurídico: Escudo antideepfake — migration 0013 + frontend (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0013_monitoramento_evidencia.sql` (novo), `.pipeline/monitoramento_evidencia_test.sql` (novo), `apps/web/app/monitoramento/MonitoramentoForm.tsx` (calcula hash), `apps/web/app/monitoramento/page.tsx` (selo "Evidência lacrada"), `apps/web/app/dossie-juridico/page.tsx` (novo), `components/AppHeader.tsx` (nav).
- **Decisão de arquitetura (usuário confirmou depois de eu recomendar):** estende `monitoramento_itens` em vez de criar `evento_ameaca` separada — motivo e trade-off já registrados em specs.md.
- **Decisões técnicas:**
  - `hash_evidencia`/`hash_calculado_em` nullable, com 2 CHECKs (`hash_so_para_ameaca`, `hash_par_completo`) em vez de trigger — mesma lógica de "CHECK quando só depende de colunas da própria linha" já usada em `pecas_conteudo`. Efeito colateral bom: o CHECK de categoria também impede trocar a categoria pra fora do escopo de ameaça depois de já ter hash (revalidado em todo UPDATE).
  - Trigger `bloquear_edicao_evidencia_lacrada` (BEFORE UPDATE): uma vez `hash_evidencia` preenchido, `descricao`/`url`/`captura_path`/`hash_evidencia`/`hash_calculado_em` ficam travados; `status`/`gravidade` continuam livres. Construído mesmo sem existir tela de edição de `monitoramento_itens` ainda — defesa em profundidade adiantada, mesmo padrão do resto do projeto.
  - Hash calculado **client-side** via `crypto.subtle.digest('SHA-256', ...)` no momento do upload, só quando a categoria é uma das 3 de ameaça e há arquivo — decisão que o usuário delegou a mim. Documentei explicitamente (spec + texto na UI do dossiê) que isso é prova de cadeia de custódia interna, não notarização de autoridade externa — pra não a UI prometer mais do que o sistema garante.
  - Ampliei o `accept` do input de arquivo em `MonitoramentoForm` de `image/*,application/pdf` pra incluir `video/*,audio/*` — a especificação original do escudo antideepfake é sobre vídeo/áudio manipulado, o accept anterior (herdado do monitoramento genérico) não cobria o caso de uso central deste módulo. Achado durante a implementação, não estava no critério de aceite original, corrigido por ser óbvio e barato.
  - `/dossie-juridico` não abre RLS nova — é só um filtro de leitura (`hash_evidencia IS NOT NULL`) sobre a mesma policy `monitoramento_itens_select` já testada, reaproveita `VerCapturaButton` existente.
- **Testado real contra staging (9/9 via `supabase db query --linked`):** insere item de ameaça com hash (positivo), hash fora de categoria de ameaça bloqueado (CHECK), hash sem timestamp bloqueado (CHECK), UPDATE de status em item lacrado continua funcionando (positivo), UPDATE de descrição/captura_path em item lacrado bloqueado (trigger), UPDATE de categoria pra fora do escopo em item lacrado bloqueado (CHECK), item de ameaça sem captura fica sem hash (positivo, não força prova onde não há o que hashear), isolamento cross-tenant no filtro do dossiê.
- **Testado no navegador (contra staging, usuário `advogado_responsavel` de teste já existente):** simulei seleção de arquivo via `DataTransfer` + evento `change` no `<input type="file">` real (mesma limitação de sempre pra dirigir o seletor nativo do SO nesta ferramenta de automação — mas diferente de sessões anteriores, aqui o evento disparado exercita o componente real de ponta a ponta, não só chama `supabase.storage.upload()` isolado). Registrei item "Deepfake suspeito" com arquivo: selo "🔒 Evidência lacrada" apareceu na hora, sem ação manual extra. `/dossie-juridico` listou só esse item (o item pré-existente "Ameaça jurídica" sem arquivo ficou de fora, corretamente), com hash SHA-256 e carimbo de data/hora visíveis.
  - **Achado de metodologia de teste, não bug do app:** o botão "Ver captura" pareceu não disparar nada checando `read_network_requests` — mas essa ferramenta só captura recursos same-origin (chunks do Next.js), nunca as chamadas cross-origin ao Supabase (nem login, nem insert, nem storage — nenhuma delas jamais apareceu no log, incluindo as que sabidamente funcionaram). Confirmei o funcionamento real interceptando `window.open` via `javascript_tool`: a URL assinada correta do Storage foi gerada e passada pra `window.open`. Registrado aqui pra quem for testar de novo não repetir o mesmo susto.
- **Nota de ambiente:** mesmo token de acesso pessoal da entrada anterior, ainda válido (usuário ainda não tinha revogado). Reforço o pedido de revogação ao final desta sessão.
- **Desvio da spec:** nenhum, além do `accept` do input (já justificado acima como correção óbvia, não mudança de escopo).
- **Fora desta entrega (registrado, não esquecido):** matriz de alertas + encaminhamento formal à Justiça Eleitoral — parte 3 do bloco jurídico, spec seguinte.
- **Pendências para o Testador:** nenhuma pendência bloqueante — já testado real (banco + navegador) nesta mesma entrada. Dados de teste (item + arquivo) removidos do staging ao final.

---

## [2026-07-16] Remodelagem do campo — Lideranças (sem login), metas, tarefas, mapa — migrations 0014-0016 + frontend (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/{0014_liderancas_enums,0015_liderancas_metas_tarefas,0016_agregados_campo}.sql` (novos), `.pipeline/liderancas_test.sql` (novo), `apps/web/app/{liderancas,tarefas,cidadaos,geolocalizacao}/*` (novo), `apps/web/app/usuarios/{InviteUserForm,TerritorioForm}.tsx` (editados), `components/AppHeader.tsx` (nav), `apps/web/package.json` (+ `react-leaflet`, `leaflet`, `@types/leaflet`).
- **Contexto:** o cliente informou que o modelo real de operação não usa "embaixador com login + PWA offline" — a liderança de campo é uma pessoa sem acesso ao sistema que traz formulários físicos preenchidos; a equipe digita. Pediu telas no formato de um produto concorrente (referência visual do usuário): tabela de lideranças com cidade/bairro/telefone/meta/progresso, painel de metas (por liderança/território/geral), painel de tarefas, e mapa de cobertura por bairro — sem o "link de cadastro público" do produto de referência.
- **Decisões técnicas:**
  - `embaixador` **não foi removido nem renomeado no banco** — fica como papel legado (usuário já existente continua funcionando), só sumiu das opções de convite. A liderança é uma tabela nova (`liderancas`), sem login, sem RLS de "dono" — é registro gerenciado pela coordenação/marketing, decisão que evita reescrever e reretestar toda a hierarquia de papéis já validada (migrations 0005/0006).
  - **Quem digita os formulários:** só `coord_campanha` — decisão do Planejador, não perguntada. Abrir INSERT de `cidadaos` pra marketing quebraria o modelo de PII já testado (0006 exclui marketing/jurídico de dado nominal de cidadão). Novo valor de enum `formulario_lideranca` em `origem_cadastro_cidadao` + CHECK exigindo `lideranca_id` — a trava "nunca por importação" (enum fechado) continua intacta.
  - **Meta é uma tabela própria (`metas`), não uma coluna solta** — única fonte de verdade também pra coluna "Meta" da tabela de lideranças, com CHECKs de coerência tipo↔FK (lideranca só com lideranca_id, território só com territorio_id, geral com nenhum).
  - **Progresso é sempre calculado, nunca armazenado** — 4 funções `SECURITY DEFINER` (`agregados_liderancas`, `agregados_territorios`, `agregados_campanha`, `mapa_territorios`, `mapa_eleitores`) devolvem só contagens agregadas da própria campanha, nunca linha de `cidadaos`. Isso é o que permite `coord_marketing` ver "quantos cadastros" numa liderança sem violar a regra de PII da 0006 — contorna a RLS de propósito (é `SECURITY DEFINER`), mas só expõe números, nunca nome/whatsapp.
  - **Mapa:** território ganhou `cidade` (texto) e `centro` (`GEOGRAPHY(POINT)`). Cidadão individual **não é geocodificado** — só conta no círculo do território dele; a busca de coordenada usa a API pública do Nominatim/OpenStreetMap (`TerritorioForm`), mandando só "bairro, cidade" (nunca dado pessoal). Cor do círculo é derivada do % da meta do território (sem meta = azul, <70% vermelho, 70-99% âmbar, 100%+ verde) — calculada no cliente a partir do agregado, não armazenada.
  - Leaflet exige `window`, por isso `MapaCobertura` é importado via `next/dynamic` com `ssr: false` (`MapaWrapper` é o client boundary).
  - `consentimentos_lgpd` é append-only (trigger da migration 0001) — o form de `/cidadaos` grava cidadão + consentimento em duas chamadas; se o consentimento falhar depois do cidadão já ter sido salvo, o erro fica visível na tela (não esconde a falha), porque não existe rollback automático entre as duas chamadas client-side.
- **Testado real contra staging (14/14 via `supabase db query --linked`):** coord_marketing cria liderança (positivo), candidato não cria liderança, isolamento cross-tenant (liderancas/metas/tarefas), coord_campanha digita cidadão com liderança própria (positivo), liderança de outra campanha rejeitada, formulário sem lideranca_id rejeitado (CHECK), coord_marketing NÃO digita cidadão (modelo de PII preservado), meta geral criada (positivo), meta tipo lideranca sem FK rejeitada (CHECK), DELETE de meta (redator=0 linhas, coord_marketing=1), redator cria tarefa (positivo), candidato não cria tarefa, DELETE de tarefa (redator=0, coord_campanha=1), candidato lê liderancas (positivo, leitura liberada a todos).
- **Testado no navegador (contra staging):** MFA verify de conta já enrolada nesta sessão via TOTP gerado localmente (script `totp.mjs`, RFC 6238, mesmo secret mostrado na tela de enroll) — sem precisar de app autenticador externo. Fluxo completo real: criei 2 lideranças (uma sem território, uma com território "Boa Viagem/Recife" geocodificado de verdade via Nominatim), digitei 2 cidadãos atribuídos a cada uma, conferi que o agregado de cadastros/progresso atualizou em `/liderancas`, e que `/geolocalizacao` renderizou um círculo real no mapa (Leaflet + tiles OpenStreetMap) em cima de Boa Viagem, com popup mostrando cadastros/apoiadores/lideranças corretos e o aviso "N sem coordenada" contando certo o cidadão do território sem centro definido. Confirmei também que `coord_marketing` vê a mensagem de bloqueio de LGPD em `/cidadaos` (sem acesso à base nominal) mas consegue gerenciar lideranças normalmente (números agregados, nunca nome de cidadão).
- **Nota de ambiente:** mesmo access token de sessão anterior, ainda válido.
- **Desvio da spec:** nenhum.
- **Pendência de limpeza (não um bug):** os 2 cidadãos de teste + seus consentimentos LGPD **não puderam ser removidos do staging** — `consentimentos_lgpd` é append-only por trigger (mesmo trigger que a Módulo 1 testou e validou), e a FK bloqueia apagar o cidadão enquanto o consentimento existir. Isso é o design funcionando corretamente (é exatamente a garantia que o LGPD exige), só registrando que o staging ficou com esse resíduo inofensivo (2 cidadãos de teste, campanha "Candidata Teste E2E") em vez de limpo como nas entregas anteriores. `liderancas`/`territorios` de teste também ficaram, por tabela ligada via FK aos cidadãos presos. `metas`/`tarefas` de teste foram removidas normalmente.
- **Fora desta entrega (registrado, não esquecido):** edição de liderança/território existente (só criação, sem tela de update além do toggle de status); exportação do mapa; 2º turno não considerado em nada disso ainda.
- **Pendências para o Testador:** nenhuma pendência bloqueante — já testado real (banco + navegador) nesta mesma entrada.

---

## [2026-07-16] Módulo 3 — Jurídico parte 3: Matriz de alertas + encaminhamento — migrations 0017/0018 + frontend (fecha o bloco jurídico, ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/{0017_alertas,0018_fix_trigger_alertas_security_definer}.sql` (novos), `.pipeline/alertas_test.sql` (novo), `apps/web/app/alertas/{page.tsx,AlertaCard.tsx}` (novo), `apps/web/app/usuarios/InviteUserForm.tsx` + `apps/web/app/api/usuarios/invite/route.ts` (campo telefone), `components/AppHeader.tsx` (nav).
- **Decisões técnicas:**
  - Gatilho fixo (não configurável nesta entrega): `monitoramento_itens` com categoria de ameaça (`ameaca_juridica`/`deepfake_suspeito`/`gestao_crise`) + `gravidade = 'alta'` gera 1 linha em `alertas` por papel destinatário fixo (`advogado_responsavel`, `coord_campanha`) — matriz configurável de verdade (por gravidade x categoria x destinatário) fica pra depois, se o cliente pedir.
  - **Canal WhatsApp decidido, mas sem provedor configurado** (usuário pediu pra resolver depois — mesmo padrão da `ANTHROPIC_API_KEY` no Módulo 4). `status_envio` nasce `pendente_configuracao`; a UI avisa isso explicitamente em vez de fingir que enviou. Adicionei `telefone` em `usuarios_internos` (formulário de convite) pra já existir onde guardar o destino quando o envio ligar.
  - Trigger só grava a fila no banco — a chamada HTTP pro provedor de WhatsApp (quando existir) roda numa Route Handler da aplicação, não em Postgres, mesmo padrão de "IA roda na aplicação" do Módulo 4.
  - Encaminhamento: campo de nota livre, não um número de processo validado — decisão do usuário de simplificar pra "só um aviso de que o advogado já encaminhou", sem tentar modelar um protocolo formal do TSE.
  - Separação de poder (encaminhamento exclusivo do `advogado_responsavel`) reforçada por trigger, mesmo padrão de `pecas_conteudo` (Módulo 3 parte 1) — RLS de UPDATE não distingue quais colunas mudaram dentro do mesmo comando. Mesmo trigger garante `encaminhado_por = auth.uid()`.
- **Bug real encontrado e corrigido durante o próprio teste (migration 0018):** a primeira versão do trigger `gerar_alertas_ameaca_grave()` não era `SECURITY DEFINER` — rodava com o privilégio de quem inseriu o `monitoramento_item` (role `authenticated`), e como `alertas` não tem policy de INSERT (só o trigger deveria escrever ali), a própria RLS bloqueava a fila de nascer. Descoberto no primeiro round de teste (`new row violates row-level security policy`), corrigido com `SECURITY DEFINER SET search_path = public` na função (mesmo padrão das helpers de RLS da migration 0001), sem precisar reescrever a 0017 já aplicada.
- **Testado real contra staging (9/9 via `supabase db query --linked`):** gravidade alta gera 2 alertas (positivo), gravidade média não gera nada, categoria não-ameaça não gera nada, isolamento cross-tenant, `coord_marketing` marca "lido" (positivo — leitura/interação liberada a todos), `coord_marketing` NÃO marca encaminhamento (trigger bloqueia), `advogado_responsavel` marca encaminhamento com nota (positivo), `encaminhado_por` ≠ `auth.uid()` bloqueado, `status_envio` nasce `pendente_configuracao`.
- **Testado no navegador (contra staging):** registrei um item real de deepfake gravidade alta em `/monitoramento` → 2 alertas apareceram na hora em `/alertas`, com o aviso de WhatsApp pendente visível. Logado como `coord_marketing`: marquei "lido" (funcionou), confirmei que o botão de encaminhamento não aparece pra esse papel. Logout, login como `advogado_responsavel`: botão aparece nos dois alertas (mesmo item, destinatários diferentes), marquei encaminhamento com nota — virou selo "✅ Encaminhado em [data] por Advogado Teste E2E" com a nota, e o OUTRO alerta do mesmo item continuou intacto/independente (cada destinatário tem sua própria linha de rastreio). Dado de teste removido do staging ao final.
- **Desvio da spec:** nenhum.
- **Fecha o Módulo 3 (bloco jurídico) inteiro:** rotulagem IA + escudo antideepfake + matriz de alertas/encaminhamento — as 3 partes da Camada 3 "proteção jurídica" agora têm schema testado; só falta ligar o provedor de WhatsApp quando o usuário decidir qual usar.
- **Pendências para o Testador:** nenhuma pendência bloqueante — já testado real (banco + navegador) nesta mesma entrada. Envio de WhatsApp de verdade é dependência externa conhecida, não um bug.

---

## [2026-07-16] Território: bairro vira opcional (cidade pequena não obriga granularidade de bairro)

- **Contexto:** usuário perguntou se o mapa de lideranças conseguia marcar por bairro OU por cidade — cidade pequena pode ter uma liderança só pra cidade inteira, sem sentido forçar um nome de bairro específico.
- **Achado:** `territorios.nome_bairro` já era `TEXT` nullable desde a migration 0001 — o banco sempre suportou isso. O bloqueio era só no frontend: `TerritorioForm` marcava Bairro como `required`. Nenhuma migration nova foi necessária, só frontend.
- **Arquivos alterados:** `apps/web/lib/territorio.ts` (novo — `labelTerritorio(bairro, cidade)`, fallback: bairro+cidade / só bairro / só cidade / "—"), `apps/web/app/usuarios/TerritorioForm.tsx` (bairro opcional, exige cidade quando bairro vazio, busca Nominatim funciona só com cidade), e os 6 lugares que exibiam bairro (`LiderancaForm`, `MetaForm`, `liderancas/page.tsx`, `CidadaoForm`, `cidadaos/page.tsx`, `geolocalizacao/MapaCobertura.tsx`) passaram a usar o helper em vez de concatenar `nome_bairro`/`cidade` manualmente (alguns desses concatenavam errado quando bairro era nulo, ex.: mostraria "— · Recife").
- **Testado no navegador (contra staging):** criei território só com cidade ("Igarassu", bairro em branco) — busca de coordenada no Nominatim funcionou só com "Igarassu, Brasil" (retornou coordenada real). Apareceu limpo como "Igarassu" no select de território (sem separador sobrando). Criei liderança nesse território; no mapa, o círculo de Igarassu renderizou na localização geográfica correta com popup mostrando "Igarassu" (sem bairro), 0 cadastros, 1 liderança. Dado de teste removido do staging ao final.
- **Nota de teste:** na primeira leitura via JS do SVG do Leaflet, um dos círculos apareceu com path degenerado (`M0 0`) — parecia bug, mas era só timing (leitura do DOM antes do Leaflet terminar de projetar após a navegação). Um reload resolveu e o screenshot confirmou o círculo certo, com dado certo — registrado aqui pra não confundir numa próxima verificação.
- **Desvio da spec:** nenhum — é um ajuste de UX descoberto em conversa com o usuário, não uma spec formal prévia.

---

## [2026-07-16] Módulo Relacionamento — parte 1: Cadastro de apoiadores — migration 0019 + frontend (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0019_apoiadores.sql` (novo), `.pipeline/apoiadores_test.sql` (novo), `apps/web/app/apoiadores/{page.tsx,ApoiadorForm.tsx,ApoiadoresTable.tsx}` (novo), `components/AppHeader.tsx` (nav).
- **Contexto:** primeira peça nova do Bloco Relacionamento, depois de alinhar escopo com o usuário (cidadão só recebe informação, nunca interage direto — sem superfície pública nova; "rede de embaixadores" da spec original já virou Lideranças). Apoiador é pessoa que se oferece pra ajudar a campanha, não precisa já ser eleitor cadastrado.
- **Decisões técnicas:**
  - **Base legal mais leve que `cidadaos`:** sem `consentimentos_lgpd` formal — decisão do usuário (legítimo interesse pra coordenação de voluntários, não consentimento explícito de intenção de voto). Registrado como divergência do padrão do resto do sistema, pro Revisor confirmar com o jurídico do cliente antes de uso real.
  - **`cidadao_id` opcional, só `coord_campanha` liga/desliga:** `coord_marketing` também gerencia apoiadores, mas não tem acesso a dado nominal de `cidadaos` (regra da migration 0006) — deixá-lo setar `cidadao_id` livremente contornaria essa trava. Reforçado por **dois** triggers (INSERT e UPDATE separados, porque o de UPDATE usa `OLD` pra comparar e o de INSERT não tem `OLD`), mesmo padrão de separação de poder de `pecas_conteudo`/`alertas`.
  - **`formas_ajuda` é enum de múltipla escolha** (`forma_ajuda_apoiador[]`), não texto livre — mantém consistência com o resto do sistema (categoria controlada + campo de detalhe livre).
  - **Aviso de compliance na UI, não trava:** selecionar "Doação de material" mostra alerta de que doação em espécie pode ter que constar na prestação de contas eleitoral (Lei 9.504/1997) — só aviso, sem workflow de compliance completo nesta entrega.
  - RLS espelha `liderancas`: leitura liberada a todos os papéis internos, gestão por `coord_campanha` + `coord_marketing`, sem DELETE (só status ativo/inativo).
- **Achado durante o próprio teste (não é bug de produto, é lição de metodologia):** os testes 2 e 8 do primeiro round pareceram falhar (`coord_marketing` conseguindo vincular `cidadao_id`), mas o problema era o SCRIPT de teste: a subquery `(SELECT id FROM cidadaos WHERE nome=...)` rodava sob a própria sessão de `coord_marketing`, que já não tem RLS pra ler `cidadaos` — a subquery voltava `NULL` antes mesmo do trigger novo entrar em ação, mascarando o que o teste queria provar. Corrigido guardando o `cidadao_id` da fixture numa tabela auxiliar (fora do contexto de RLS) antes de trocar de papel — mesma lição de "cuidado ao testar separação de poder quando a própria leitura já é restrita" que vale registrar pra próximas specs parecidas.
- **Testado real contra staging (8/8 via `supabase db query --linked`, após a correção do script):** `coord_marketing` cria apoiador sem `cidadao_id` (positivo), `coord_marketing` NÃO vincula cidadão (trigger bloqueia, mensagem clara), `coord_campanha` vincula cidadão da própria campanha (positivo), `cidadao_id` de campanha diferente rejeitado, `candidato` lê apoiadores (positivo) mas não cria, isolamento cross-tenant, `coord_marketing` NÃO alterá `cidadao_id` via UPDATE (mesma trava, testada nos dois sentidos INSERT/UPDATE).
- **Testado no navegador (contra staging):** logado como `coord_campanha`, criei apoiador "Marcos Vieira" com formas de ajuda (Transporte + Doação de material — aviso de compliance apareceu na hora) vinculado ao eleitor "Eleitor Teste E2E" já existente — apareceu na lista com o selo "(vinculado a eleitor)". Logout, login como `coord_marketing`: o campo "Já é eleitor cadastrado?" **não aparece** no formulário, e o card do Marcos Vieira **não mostra** o selo de vínculo (RLS escondendo o join com `cidadaos`, nenhum sinal de PII vaza). Criei um segundo apoiador como `coord_marketing` sem vínculo — funcionou normalmente. Dado de teste removido do staging ao final.
- **Desvio da spec:** nenhum.
- **Fora desta entrega (registrado, não esquecido):** enquete e plano de governo, loop de demanda legislativa, histórico de mandato — as outras 3 peças do Bloco Relacionamento, ainda não construídas.
- **Pendências para o Testador:** nenhuma pendência bloqueante — já testado real (banco + navegador) nesta mesma entrada.

---

## [2026-07-16] Cadastro de mensagens — migration 0020 + Route Handler + frontend (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0020_mensagens.sql` (novo), `.pipeline/mensagens_test.sql` (novo), `apps/web/app/api/mensagens/enviar/route.ts` (novo), `apps/web/app/mensagens/{page.tsx,MensagemForm.tsx}` (novo), `components/AppHeader.tsx` (nav).
- **Contexto:** depois de decidir adiar "loop de demanda legislativa" (só faz sentido pra quem já tem mandato — fora de escopo junto com histórico de mandato), usuário pediu um cadastro de mensagens: destinatário (eleitor/apoiador/liderança já cadastrado, não texto livre), canal, status, data, guardando o conteúdo também, com envio de verdade (não só log manual).
- **Decisões técnicas:**
  - **Destinatário polimórfico:** `tipo_destinatario` enum + 3 FKs nullable (`cidadao_id`/`apoiador_id`/`lideranca_id`) + CHECK de coerência (exatamente um preenchido de acordo com o tipo) — mesmo idioma já usado em `metas` (migration 0015).
  - **Trava estrutural contra disparo em massa:** uma linha = uma mensagem = um destinatário. Não existe array de destinatários nem seleção múltipla na tela — não é só uma regra de negócio, é a própria modelagem de dados que impede.
  - **RLS condicional por tipo_destinatario, não uma trava única pra tabela inteira:** mensagem pra cidadão só é lida por quem já vê PII nominal de cidadão (mesma exclusão da migration 0006); mensagem pra apoiador/liderança é visível a todos. Mesma ideia pra INSERT: cidadão só `coord_campanha`; apoiador/liderança também libera `coord_marketing`.
  - **Route Handler, não INSERT direto do cliente** (mesmo motivo do Módulo 4): precisa checar segredo de servidor (credencial de provedor de WhatsApp) e, no futuro, chamar a API de envio. `POST /api/mensagens/enviar` resolve o telefone do destinatário usando a **sessão do próprio usuário** (não `service_role`) — se a RLS da tabela de destino já bloqueia aquele papel (`coord_marketing` tentando mandar pra cidadão), a busca do telefone simplesmente não acha nada e a rota nem tenta montar o envio. Defesa em profundidade, mesma lógica do vínculo `cidadao_id` em `apoiadores`.
  - **Sem provedor de WhatsApp configurado** (mesma pendência do Módulo 3/alertas — usuário ainda não forneceu credencial). `tentarEnviarWhatsApp()` já existe como função isolada, pronta pra receber a chamada real da API quando houver `WHATSAPP_API_TOKEN`; hoje sempre retorna `pendente_configuracao` com o motivo exato. UI não finge que enviou.
  - Sem policy de UPDATE/DELETE pra usuário — o status final é decidido dentro da mesma requisição que cria a mensagem, antes do INSERT. Vira log imutável na prática.
- **Testado real contra staging (10/10 via `supabase db query --linked`, aplicando a lição da entrada anterior — fixtures de destinatário guardadas em tabela auxiliar antes de qualquer troca de papel, não subquery direta sob RLS restrita):** `coord_marketing` manda mensagem pra apoiador (positivo), `coord_marketing` NÃO manda pra cidadão, `coord_campanha` manda pra cidadão (positivo), `redator_marketing` não manda mensagem nenhuma, CHECK de coerência tipo/FK rejeitado, destinatário de outra campanha rejeitado (trigger), mensagem nasce `pendente_configuracao`, `coord_marketing` NÃO lê mensagem pra cidadão, `coord_marketing` lê mensagem pra apoiador (positivo), isolamento cross-tenant.
- **Testado no navegador (contra staging):** criei apoiador de teste, logado como `coord_marketing` mandei mensagem pra ele via `/mensagens` — aviso claro "WhatsApp ainda não está configurado" apareceu, com o detalhe exato (`WHATSAPP_API_TOKEN ausente`) salvo na mensagem. Logout, login como `coord_campanha`: opção "Eleitor" aparece no destinatário (não aparecia pro `coord_marketing`), mandei mensagem pra um eleitor existente, mesmo resultado de pendência. **Verificação final da visibilidade condicional foi feita via SQL direto** (sessão de navegador foi interrompida antes do segundo login) — simulei `coord_marketing` e confirmei: 1 mensagem visível no total (a do apoiador), 0 mensagens de tipo `cidadao` visíveis, batendo exatamente com o teste 8 do banco. Dado de teste removido do staging ao final.
- **Desvio da spec:** nenhum.
- **Fora desta entrega (registrado, não esquecido):** envio real por WhatsApp (bloqueado por credencial de provedor); enquete e plano de governo é a única peça do Bloco Relacionamento ainda não atacada.
- **Pendências para o Testador:** nenhuma pendência bloqueante — testado real (banco 10/10 + navegador, com a última verificação de RLS confirmada por SQL em vez de segunda sessão de navegador, registrado aqui por transparência de método).

---

## [2026-07-18] Layout novo — sidebar agrupada + dashboard

- **Arquivos alterados:** `components/AppShell.tsx` (novo, substitui `components/AppHeader.tsx`, removido), `app/dashboard/page.tsx` (novo), `app/page.tsx` (redirect pro dashboard), e as 16 páginas internas trocando `AppHeader` por `AppShell` como wrapper.
- **Contexto:** usuário mostrou uma referência visual (dashboard com sidebar escura agrupada por seção) e pediu algo "mais bonito" nessa linha.
- **Decisões técnicas:**
  - Sidebar fixa (`AppShell`, client component por causa de `usePathname` pro item ativo) agrupa os 15 módulos em Cadastros/Gestão/Comunicação/Análise/Administração — grupos batem com a organização real do sistema, não são genéricos copiados da referência.
  - `/dashboard` novo: cards de métrica com contagens reais (`count: "exact", head: true`) direto das tabelas existentes, **sem lógica de papel nenhuma** — a contagem já reflete a RLS da sessão do próprio usuário (quem não pode ler uma tabela simplesmente vê 0 ali).
  - Nenhuma tabela nova, nenhuma migration — é 100% reorganização de frontend sobre dado que já existia.
- **Testado no navegador:** criei campanha de teste, passei pelo MFA, confirmei o dashboard renderizando os 6 cards, naveguei entre `/cidadaos` e `/mensagens` com o item ativo da sidebar mudando corretamente, sem erro de console. Dado de teste removido do staging com token fornecido pelo usuário (contagem confirmada zerada depois).
- **Desvio da spec:** nenhum (não houve spec formal — foi decisão de UI discutida em chat, não uma feature de dado).
- **Pendências para o Testador:** nenhuma.

---

## [2026-07-18] Monitoramento — busca automática de menções (ref. specs.md mesma data)

- **Arquivos alterados:** `app/api/monitoramento/buscar/route.ts` (novo), `app/monitoramento/BuscaMencoesPanel.tsx` (novo), `app/monitoramento/MonitoramentoWorkspace.tsx` (novo), `app/monitoramento/MonitoramentoForm.tsx` (ganhou props opcionais `prefillUrl`/`prefillDescricao`), `app/monitoramento/page.tsx` (troca `MonitoramentoForm` por `MonitoramentoWorkspace`).
- **Contexto:** usuário mandou um reel sobre "IA acha todas as suas fotos na internet" e perguntou se eu conseguia fazer isso. Recusei replicar busca reversa de imagem/reconhecimento facial (ferramenta de vigilância, risco de uso indevido contra terceiros) e propus a alternativa discutida em chat: busca por palavra-chave (nome do candidato), sempre trazendo candidatos a item pra revisão humana, nunca inserindo sozinho. Usuário confirmou.
- **Decisões técnicas:**
  - **Sem tabela nova.** Resultado da busca é efêmero — só existe na resposta do Route Handler e no estado do componente até o usuário clicar "Usar este item", que só pré-preenche o form existente (`MonitoramentoForm`). O INSERT em `monitoramento_itens` continua passando pela mesma RLS de sempre (0007), sem bypass nenhum.
  - **Google News RSS** (`news.google.com/rss/search`) pra notícias — público, sem chave de API, funciona hoje sem nenhuma pendência. Parser é regex simples sobre `<item>` (sem dependência de XML parser).
  - **X/Twitter API v2** pra redes sociais — atrás de `TWITTER_BEARER_TOKEN` (credencial paga, ainda não fornecida pelo usuário); sem o token, a seção mostra aviso "não configurado" e não quebra o resto da busca (mesmo padrão do `WHATSAPP_API_TOKEN`/`ANTHROPIC_API_KEY`).
  - Busca é sempre sob demanda (botão "Buscar" clicado por um humano) — nenhum polling, nenhum agendamento, mesma disciplina de "toda chamada externa é uma ação explícita" já usada em Mensagens/Alertas.
  - `GET /api/monitoramento/buscar` reaplica a mesma checagem de papel do form (`PAPEIS_QUE_REGISTRAM`) em código — não é RLS (a rota não escreve no banco), então a checagem tem que estar na própria rota.
- **Testado:**
  - **Mecânica de busca isolada, fora do app:** chamei o Google News RSS direto via Node com um termo real (`"Lula"`) — 200 OK, 100 itens, parsing de título/link corretos. Confirma que o fetch+regex do Route Handler funciona contra a API real.
  - **No navegador (contra staging):** criei campanha de teste com nome fictício, logado como `coord_campanha` fui em `/monitoramento`, cliquei "Buscar" — request real pra `/api/monitoramento/buscar` voltou 200 OK, seção "Notícias" mostrou "Nenhuma notícia encontrada" (esperado, nome fictício não tem cobertura de imprensa) e seção "Redes sociais" mostrou o aviso de não configurado corretamente. Sem erro de console.
  - **Não testado nesta sessão:** o clique em "Usar este item" com um resultado real (o nome de teste não retornou nenhum resultado pra clicar) — o mecanismo (callback simples `onEscolher` → `useEffect` no form) é o mesmo padrão de estado já usado em outros formulários do projeto; validado por revisão de código, não por clique real. Também não testei a negação de papel (403) com um usuário fora de `PAPEIS_QUE_REGISTRAM` — a checagem espelha exatamente a mesma lista já testada pro form de registro.
- **Desvio da spec:** nenhum.
- **Fora desta entrega:** busca em redes sociais real (bloqueada por credencial paga da X); workflow de mudar status do item (`novo`→`em_analise`→`resolvido`) continua sem UI, é a próxima lacuna conhecida do módulo.
- **Pendências para o Testador:** validar clique em "Usar este item" com resultado real (ex.: usando um termo com cobertura de notícia de verdade) e o caminho de 403 pra papel sem permissão — nenhum dos dois é bloqueante, mas ficaram sem cobertura direta nesta sessão.

---

## [2026-07-18] Telefone obrigatório em todo cadastro de pessoa (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0021_telefone_obrigatorio.sql` (novo), `app/onboarding/OnboardingForm.tsx` (campo telefone novo), `app/usuarios/InviteUserForm.tsx` + `app/api/usuarios/invite/route.ts` (telefone deixa de ser opcional), `app/liderancas/LiderancaForm.tsx` (telefone deixa de ser opcional).
- **Contexto:** usuário pediu "não permita que ninguém seja cadastrado sem telefone". Levantamento (não uma suposição — li o schema e os 3 pontos de INSERT de pessoa) mostrou que `cidadaos.whatsapp` e `apoiadores.telefone` já eram `NOT NULL` desde a criação; as lacunas reais eram `liderancas.telefone` e `usuarios_internos.telefone`, com um caso extremo: o primeiro usuário da campanha (criado no onboarding via `bootstrap_campanha`) nunca era perguntado o telefone — o formulário nem tinha o campo.
- **Decisões técnicas:**
  - `ALTER COLUMN telefone SET NOT NULL` em `liderancas` e `usuarios_internos`, com backfill defensivo antes (`UPDATE ... SET telefone = '(sem telefone — cadastro anterior à obrigatoriedade)' WHERE telefone IS NULL`) — nunca um número inventado, um placeholder textual óbvio pra quem for usar aquele registro perceber que falta corrigir.
  - `bootstrap_campanha` ganhou `p_telefone` — como isso muda a assinatura da função (não só o corpo), a migration dá `DROP FUNCTION` explícito na versão de 6 parâmetros antes de criar a de 7, senão ficariam as duas sobrepostas (overload) no Postgres.
  - Validação em 3 camadas, mesmo padrão já usado no resto do projeto: HTML5 `required` no formulário (feedback imediato), checagem explícita no Route Handler de convite (mensagem de erro amigável), e `NOT NULL` no banco como última linha de defesa (pega qualquer inserção que não passe pelos dois primeiros, ex. chamada direta à API).
- **Testado no navegador (contra staging, servidor de dev já rodado pelo próprio usuário):**
  1. Migration aplicada — 0 linhas sem telefone depois, com 8 registros antigos (1 liderança + 7 usuários, todos da campanha travada que não pode ser apagada — ver nota LGPD anterior) recebendo o placeholder de backfill.
  2. Onboarding: criei campanha nova com o campo de telefone novo preenchido — funcionou, campanha e coord_campanha criados com telefone salvo.
  3. Convite de usuário: tentei convidar sem telefone — navegador bloqueou com "Preencha este campo" antes de qualquer request. Preenchi o telefone — passou dessa validação e chegou a um erro de negócio diferente (domínio de e-mail de teste inválido pro Supabase Auth), confirmando que a trava de telefone não é mais o que bloqueia.
  4. Liderança: tentei criar sem telefone — mesmo bloqueio client-side. Preenchi — liderança criada com telefone salvo e exibido na tabela.
  - Sem erro de console em nenhuma das 3 telas.
- **Desvio da spec:** nenhum.
- **Pendências para o Testador:** nenhuma bloqueante. Dado de teste desta entrega já removido do staging (campanha, coord_campanha e liderança criados pra teste); confirmado por contagem zerada.

---

## [2026-07-18] Editar, buscar e desativar eleitores (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0022_cidadaos_editar_desativar.sql` (novo), `app/cidadaos/CidadaoTable.tsx` (novo), `app/cidadaos/page.tsx` (troca a tabela inline pelo componente novo, remove `.limit(20)`).
- **Contexto:** usuário pediu "editar, deletar e consultar" cadastro, de forma geral. Auditoria (ver Explore agent) mapeou que nenhuma tela tinha edição completa e só `tarefas` tinha exclusão de verdade; pra `cidadaos` especificamente, `DELETE` de verdade não é viável (rastro de consentimento LGPD em `consentimentos_lgpd`, append-only, referenciando `cidadao_id`). Usuário delegou a ordem de execução ("faça como quiser"); comecei por eleitores — lacuna mais grave (nem busca real tinha, só os 20 mais recentes).
- **Decisões técnicas:**
  - `status_cidadao` (ativo/inativo) novo em `cidadaos` — "deletar" vira desativar. Sem policy de RLS nova: `cidadaos_update_coord` (migration 0001) já cobre update de qualquer coluna pra `coord_campanha`.
  - Edição por linha, inline (expande a própria linha da lista em vez de modal/página separada) — nome, whatsapp, email, território, liderança, círculo. **Não edita** `origem_cadastro`/`embaixador_coletor_id` (proveniência) nem nada de `consentimentos_lgpd` (o que foi assinado no formulário físico é imutável por design).
  - Busca client-side (mesmo padrão de apoiadores/lideranças) por nome/whatsapp/território/liderança — só faz sentido porque a query parou de cortar em `.limit(20)`.
  - Dropdown de liderança na edição usa a lista **sem filtro de status** (diferente do form de criação, que só mostra lideranças ativas) — pra não "sumir" a opção se o eleitor já estava vinculado a uma liderança desde então desativada.
- **Testado no navegador (contra staging):** criei campanha de teste, 1 liderança e 2 eleitores. Busca por "Ana" filtrou corretamente pra 1 resultado. Edição: troquei nome e círculo de um eleitor, salvei — banco confirmou a mudança persistida (`circulo: quente`, `nome: "Ana Beatriz Editada"`). Toggle de status: cliquei "Ativo" → banco confirmou `status: inativo`. Sem erro de console.
- **Desvio da spec:** nenhum.
- **Achado colateral confirmado na prática (não é bug, é o comportamento já documentado):** tentei apagar um dos cidadãos de teste pra limpar o staging — bloqueado por `consentimentos_lgpd_cidadao_id_fkey`, exatamente como esperado. **Isso significa que qualquer cidadão de teste criado a partir de agora fica permanentemente no staging** (só desativável, nunca removível) — mesma categoria de resíduo já visto na campanha "Candidata Teste E2E". Registrado pra não surpreender ninguém depois.
- **Pendências para o Testador:** nenhuma bloqueante. Dado de teste desativado (não removido — impossível) no staging: campanha "Candidato Teste Cidadaos", liderança "Lideranca Base Teste", 2 eleitores (ambos `status = inativo` agora).

---

## [2026-07-18] Editar apoiadores, lideranças e usuários internos — + correção de segurança em revogação de acesso

- **Arquivos alterados:** `app/apoiadores/ApoiadoresTable.tsx` (edição inline), `app/apoiadores/page.tsx` (passa `territorios`/`territorio_id`), `app/liderancas/LiderancasTable.tsx` (reescrito: tabela → lista com edição inline, mesmo padrão), `app/liderancas/page.tsx` (passa `territorios`/`territorio_id`), `app/usuarios/UsuariosTable.tsx` (novo), `app/usuarios/page.tsx` (troca tabela inline pelo componente novo), `supabase/migrations/0023_usuarios_internos_revogar_acesso.sql` (novo).
- **Contexto:** conclusão da frente "editar/consultar/desativar cadastros" pras 3 entidades restantes (usuário escolheu "faça como quiser" pra ordem; segui apoiadores → lideranças → usuários internos).
- **Achado de segurança (o item mais importante desta entrada):** ao planejar "revogar acesso" de usuário interno, descobri que `usuarios_internos.status` (`ativo`/`revogado`/`expirado`) existe desde a fundação do sistema (migration 0001) **mas nunca foi de fato verificado em lugar nenhum**. As 3 funções SECURITY DEFINER que sustentam praticamente toda policy de RLS do sistema — `current_papel()`, `current_campanha_id()`, `current_territorio_id()` — liam `usuarios_internos` só por `id = auth.uid()`, sem checar `status`. Ou seja: **até esta migration, marcar alguém como "revogado" não bloqueava nada** — a pessoa continuava com acesso de leitura/escrita total. Corrigi as 3 funções pra exigir `status = 'ativo'`; o efeito é em cascata (toda tabela do sistema depende dessas funções pras policies de RLS).
- **Decisões técnicas:**
  - Edição de apoiadores/lideranças: mesmo padrão de `CidadaoTable` — nome, telefone, cidade, bairro, território (+ formas de ajuda/detalhe/disponibilidade em apoiadores). Não edita `cidadao_id` do apoiador (tem trigger próprio de quem pode setar).
  - `LiderancasTable` deixou de ser `<table>` e virou lista de linhas expansíveis — o formato tabela não comporta bem uma linha virar formulário de edição sem gambiarra de colspan; mesmo padrão visual das outras 3 entidades agora.
  - Edição de usuário interno: nome, papel (recalcula `exige_mfa` a partir do papel novo, mesma regra do convite), território/expiração (só quando papel = embaixador). Não edita e-mail (é identidade do Supabase Auth, mudar aqui não mudaria o login de verdade).
  - "Revogar acesso" em vez de excluir — mesmo padrão de desativação, mas com `window.confirm` antes (ação mais consequente que um toggle simples) e **botão desabilitado pra própria linha do usuário logado** (evita autoexclusão acidental).
- **Testado no navegador + SQL direto (contra staging):**
  1. Apoiador: criei, editei nome+cidade, confirmado por SQL que persistiu.
  2. Liderança: mesma coisa, confirmado por SQL.
  3. Usuário interno: editei o papel de um usuário convidado (`redator_marketing` → `coord_marketing`), confirmado por SQL que `papel` e `exige_mfa` (recalculado corretamente pra `false`) persistiram.
  4. **Teste decisivo da correção de segurança:** simulei a sessão desse usuário via `set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE authenticated` **antes** de revogar — `current_papel()` retornou `coord_marketing` e `current_campanha_id()` o UUID da campanha, como esperado (baseline). Cliquei "Revogar acesso" na UI (com `window.confirm` sobrescrito pra retornar `true`, já que o ambiente de teste não interage com dialog nativo) — banco confirmou `status = 'revogado'`. Repeti a simulação de sessão **depois** de revogar: `current_papel()` e `current_campanha_id()` voltaram `NULL`, e uma query de `liderancas` sob essa sessão simulada retornou **0 linhas** (antes veria todas, já que `coord_marketing` tem leitura ampla). Confirma que a correção funciona de ponta a ponta, não só que o status mudou na tela.
  - Sem erro de console em nenhuma tela.
- **Desvio da spec:** nenhum.
- **Pendências para o Testador:** nenhuma bloqueante. Dado de teste: apoiador removido (nada bloqueava); liderança e campanha continuam presas pela mesma trava de LGPD via `cidadaos` (não removíveis); usuário de teste fica com `status = revogado` (estado real de "alguém que saiu da equipe", não precisa reverter).

---

## [2026-07-18] Reorganização do menu lateral (ref. specs.md mesma data)

- **Arquivos alterados:** `components/AppShell.tsx` (reordena/reagrupa `NAV_GROUPS`), `app/base-conhecimento/page.tsx` (âncora por tema).
- **Contexto:** usuário pediu ordem nova pro menu — Administração primeiro, Cadastros em seguida, "Análise" renomeado pra "Conhecimento" com conteúdo reduzido a Base de Conhecimento/Código eleitoral/Concorrentes/Pesquisa. Confirmei com o usuário o que fazer com os itens não mencionados (Gestão/Comunicação ficam como estão) e o que "Código eleitoral" deveria ser (atalho, não página nova).
- **Nova ordem/agrupamento:**
  1. Administração — Usuários
  2. Cadastros — Eleitores, Apoiadores, Lideranças (ordem interna trocada: Apoiadores agora vem antes de Lideranças)
  3. Gestão — Tarefas, Mapa, Demandas (sem mudança)
  4. Comunicação — Mensagens, Alertas (sem mudança)
  5. **Jurídico** (grupo novo) — Monitoramento, Dossiê jurídico
  6. **Marketing** (grupo novo) — Marketing, Peças de conteúdo
  7. Conhecimento (renomeado de "Análise") — Base de conhecimento, Código eleitoral, Concorrentes
- **Decisões técnicas:**
  - Jurídico/Marketing como grupos novos foi decisão minha, não pedida explicitamente — mas segue a separação conceitual que já existe nos módulos do projeto, registrada em specs.md por transparência.
  - "Pesquisa" fora do menu por enquanto — a tela ainda não existe; link morto seria pior que a ausência do item.
  - "Código eleitoral" vira `<Link href="/base-conhecimento#tema-codigo-eleitoral">` — implementei uma função `slugTema()` em `base-conhecimento/page.tsx` que gera um `id` de âncora a partir do nome de cada tema (normaliza acento, minúsculas, espaço vira hífen). Funciona só se a campanha já tiver um tema chamado exatamente "Código eleitoral" (ou variação de maiúscula, já que o slug ignora isso) — se não tiver, o link simplesmente cai no topo da página, sem quebrar nada.
- **Testado no navegador (contra staging):** confirmei via JS a ordem exata dos 7 grupos e os 17 links dentro deles (o inspector de acessibilidade da ferramenta de teste corta a lista em ~15-17 itens, então usei `document.querySelectorAll` direto pra ver a lista completa). Criei um tema "Código Eleitoral" de teste, confirmei via `document.getElementById('tema-codigo-eleitoral')` que o elemento existe com o id certo. Sem erro de console. Removido o tema de teste ao final (sem item vinculado, nada bloqueava a exclusão).
- **Desvio da spec:** nenhum além do já registrado (grupos Jurídico/Marketing e ausência de Pesquisa, ambos documentados como decisão minha).
- **Pendências para o Testador:** nenhuma bloqueante. Vale o usuário conferir se os grupos Jurídico/Marketing fazem sentido pra ele, já que não foram pedidos explicitamente.

---

## [2026-07-18] Código Eleitoral compartilhado entre campanhas (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0024_codigo_eleitoral_compartilhado.sql` (novo) — sem mudança de frontend, `ItemCard.tsx`/`base-conhecimento/page.tsx` já sabem exibir/baixar qualquer item, não precisaram saber que esse é compartilhado.
- **Contexto:** usuário notou que já tinha subido manualmente 2 PDFs de legislação eleitoral numa campanha de teste (via `.pipeline/seed_codigo_eleitoral.sql`, de uma sessão anterior) e perguntou se isso podia vir pronto no sistema, já que é a mesma lei pra qualquer campanha.
- **Decisão de arquitetura:** primeira exceção deliberada à regra "tudo isolado por `campanha_id`" — os 2 PDFs (Código Eleitoral Anotado do TSE, ~9MB, e Lei 4.737/1965, ~690KB) vivem uma vez só, no prefixo `_global/codigo-eleitoral/` do bucket `base-conhecimento` já existente, copiados via `supabase storage cp` (fora do SQL, já que storage não é manipulável por INSERT). As linhas de metadado (`temas_campanha`/`base_conhecimento_itens`/`base_conhecimento_arquivos`) continuam por campanha, RLS normal — só o `arquivo_path` aponta pro arquivo compartilhado.
- **Mecânica:**
  - Nova policy `base_conhecimento_storage_select_global`: libera leitura do prefixo `_global` pra qualquer usuário interno com `current_papel() IS NOT NULL` (ou seja, ativo — compõe automaticamente com a correção de revogação da entrada anterior). Sem policy de INSERT/UPDATE/DELETE nesse prefixo: conteúdo mantido pela operação do sistema, não editável por ninguém pela aplicação.
  - Função `seed_codigo_eleitoral(campanha_id)`: idempotente — só cria o tema+itens se a campanha ainda não tiver um tema chamado exatamente "Código Eleitoral".
  - `bootstrap_campanha` chama essa função pra toda campanha nova.
  - Backfill roda pra todas as campanhas que já existiam no momento da migration.
- **Achado durante o teste (corrigido na mesma sessão, não ficou pendente):** o backfill criou uma entrada duplicada pra campanha de teste que já tinha subido esse conteúdo manualmente antes — o tema original dela se chamava "Legislação Eleitoral" (não "Código Eleitoral" exato), então a checagem de idempotência não reconheceu e criou uma segunda entrada. Removi manualmente a duplicata (tema+itens+arquivos) pra essa campanha específica depois de confirmar por SQL. Não afeta nenhuma campanha nova daqui pra frente — só acontecia porque essa campanha específica já tinha o mesmo conteúdo sob outro nome.
- **Testado (SQL real + navegador):**
  1. Backfill confirmado nas 3 campanhas existentes no staging (incluindo uma campanha real do próprio usuário, "Alvaro Dias", criada durante os testes manuais dele — não é dado meu, não toquei nela além de deixar o conteúdo seedado).
  2. Simulação de RLS: usuário ativo de uma campanha (`Teste Cidadaos CRUD`) vê os 2 arquivos do prefixo `_global` — `SELECT count(*) FROM storage.objects WHERE ... foldername = '_global'` retornou 2. O mesmo usuário revogado (da entrada anterior) retornou 0 — a correção de `current_papel()` composição automaticamente com essa nova policy, sem precisar de lógica extra.
  3. Navegador: `/base-conhecimento` da campanha de teste mostra o tema "Código Eleitoral" com os 2 itens, título/descrição corretos, botão de baixar arquivo sem erro no clique (sem mensagem de erro renderizada, sem erro de console) — evidência de que `createSignedUrl` funcionou contra o path compartilhado.
- **Desvio da spec:** nenhum, além da correção de duplicata já descrita acima (não era esperada, mas foi resolvida na mesma entrega).
- **Pendências para o Testador:** nenhuma bloqueante.

---

## [2026-07-18] Auditoria de UX/UI — fonte, ícone próprio, ícones no app, status visual (ref. specs.md mesma data)

- **Arquivos alterados:** `app/globals.css`, `app/icon.svg` (novo), `app/favicon.ico` (removido), `public/{file,globe,next,vercel,window}.svg` (removidos, não usados), `components/AppShell.tsx`, `components/SignOutButton.tsx`, `app/dashboard/page.tsx`, `app/cidadaos/CidadaoTable.tsx`, `app/apoiadores/ApoiadoresTable.tsx`, `app/liderancas/LiderancasTable.tsx`, `app/usuarios/UsuariosTable.tsx`, `package.json`/`package-lock.json` (lucide-react).
- **Contexto:** usuário pediu análise de UX/UI e visual mais moderno; segui a ordem que recomendei (grátis → ícones → mobile fica pra decidir depois).
- **Achado tratado como bug, não como decisão de design:** `globals.css` tinha `body { font-family: Arial, Helvetica, sans-serif }` fixo, apesar do `layout.tsx` já carregar Geist Sans/Mono via `next/font` e do `@theme inline` já mapear `--font-sans` pra essas variáveis — o CSS só nunca referenciava isso. Uma linha resolveu (`font-family: var(--font-sans), Arial, Helvetica, sans-serif`), sem custo de performance (fonte já vinha baixada).
- **Ícone próprio:** `app/icon.svg` — checkmark branco num quadrado arredondado escuro (`#171717`, mesma cor da sidebar), seguindo a convenção de arquivo do Next.js (vira favicon automaticamente, sem precisar referenciar em `metadata`). Removidos o favicon genérico e os SVGs de exemplo do template padrão que não eram usados em lugar nenhum (confirmado por busca antes de apagar).
- **Ícones em lucide-react** (nova dependência, ~instalada limpa):
  - Todo item de nav da sidebar ganhou um ícone à esquerda, mapeado por significado (Eleitores=Users, Apoiadores=Heart, Lideranças=Network, Alertas=Bell, Dossiê jurídico=Scale, Código eleitoral=Gavel, etc.) — mesma ideia já mostrada no mockup que o usuário aprovou antes.
  - Botão "Sair" ganhou ícone de logout.
  - Os 6 cards do dashboard ganharam ícone por métrica, reaproveitando os mesmos ícones da sidebar (consistência visual).
  - Badges de status (ativo/inativo/revogado) em eleitores, apoiadores, lideranças e usuários internos ganharam uma bolinha (`bg-current`, então herda a cor do texto/pill automaticamente — sem lógica de cor duplicada) antes do texto, tanto na versão clicável (toggle) quanto na versão só-leitura.
- **Testado no navegador (contra staging):** `/dashboard` (ícones de sidebar + cards, fonte Geist confirmada via `getComputedStyle`), `/cidadaos` (bolinha de status "Inativo" em 2 registros de teste), `/usuarios` (bolinha em "Ativo" e em "Revogado", cor certa em cada). Confirmei o `icon.svg` sendo servido (`200`, `image/svg+xml`) direto por fetch. Sem erro de console em nenhuma tela.
- **Desvio da spec:** nenhum.
- **Fora desta entrega:** ícones em botões de ação por linha (Editar/Excluir), cor de destaque própria, responsividade mobile — aguardando decisão do usuário sobre escopo.
- **Pendências para o Testador:** nenhuma bloqueante.

---

## [2026-07-19] Cor de destaque, ícones de ação e responsividade mobile (ref. specs.md mesma data)

- **Arquivos alterados:** 28 arquivos de formulário/tabela (cor de destaque, batch via `sed` sobre uma classe idêntica confirmada por grep antes de aplicar), `components/AppShell.tsx` (reescrito — drawer mobile), `app/globals.css` (anel de foco global), `app/cidadaos/CidadaoTable.tsx`, `app/apoiadores/ApoiadoresTable.tsx`, `app/liderancas/LiderancasTable.tsx`, `app/usuarios/UsuariosTable.tsx` (ícones de ação), `app/tarefas/TarefaRow.tsx`, `app/liderancas/MetaDeleteButton.tsx`, `app/base-conhecimento/ItemCard.tsx`, `app/pecas-conteudo/PecaCard.tsx` (ícones + emoji trocado por ícone), mais 20 arquivos com grid de formulário (stacking mobile).
- **Contexto:** conclusão da auditoria de UX/UI — usuário pediu os 3 itens que tinham ficado em aberto.
- **Decisões técnicas:**
  - **Cor de destaque (indigo):** antes de decidir, considerei que cores fortes (vermelho, azul, verde-amarelo) já são disputadas por legendas brasileiras — indigo evita qualquer leitura de "o sistema favorece o partido X". Troca feita via `sed` em 28 arquivos porque o botão primário usava a mesma string de classe **idêntica** em cada um (confirmado por `grep` antes de rodar, não assumido) — mudança mecânica de baixo risco, verificada depois com `grep` de contagem (0 ocorrências antigas restantes).
  - **Anel de foco:** em vez de editar campo por campo em 20+ formulários, adicionei uma regra `:focus-visible` global em `globals.css` — cobre todo `input`/`select`/`textarea` que não já defina o próprio focus (só as telas de auth tinham foco customizado, essas eu troquei a cor separadamente).
  - **Ícones:** só toquei os botões de ação mais usados (Editar/Salvar/Cancelar/Excluir/Adicionar/Aprovar nas 4 telas de cadastro principais + tarefas/metas/base de conhecimento/peças de conteúdo) — não persegui cada botão do sistema pra não estourar o escopo desta entrega; o que ficou de fora está listado em specs.md.
  - **Mobile — sidebar:** `AppShell` ganhou estado `menuAberto` (só existe em telas pequenas — `md:` sempre mostra a sidebar fixa como antes). Drawer usa `fixed` + `-translate-x-full`/`translate-x-0` com transição, overlay `bg-black/40` fecha ao clicar fora, e um `useEffect` no `pathname` fecha o menu automaticamente ao trocar de rota (sem isso, o drawer ficaria aberto por cima da tela nova).
  - **Mobile — formulários:** os 32 grids de 2/3 colunas sem nenhum prefixo responsivo (achado já registrado na primeira rodada da auditoria) viraram `grid-cols-1 ... sm:grid-cols-N` — mesma técnica de `sed` em massa, já que a string de classe também era idêntica nas 32 ocorrências.
- **Testado no navegador (contra staging, viewport mobile 375×812 e desktop 1280×800):**
  - Mobile: sidebar escondida por padrão, botão de hambúrguer abre o drawer com overlay, item ativo em indigo, clique em "Eleitores" navega **e** fecha o drawer sozinho. Formulário de eleitor renderizado em coluna única (nome/whatsapp/e-mail/bairro/temperatura/liderança, um embaixo do outro) — antes ficaria espremido em 2-3 colunas numa tela de 375px. Lista de eleitores com botão "Editar" (ícone de lápis) e badge de status com bolinha, sem overflow horizontal.
  - Desktop: sidebar volta a ficar sempre visível, sem hambúrguer; grids voltam a 2/3 colunas. Nenhuma regressão visual em relação ao estado anterior.
  - Sem erro de console em nenhuma tela, em nenhum dos dois viewports.
- **Desvio da spec:** nenhum.
- **Fora desta entrega:** emojis remanescentes em 6 arquivos (⚠️/📍/🎯/🔒) e ícones em ações secundárias mais profundas — registrados em specs.md, não esquecidos.
- **Pendências para o Testador:** nenhuma bloqueante.

---

## [2026-07-19] Módulo 3 Jurídico — limpeza dos emojis remanescentes (ref. specs.md mesma data)

- **Arquivos alterados:** `app/monitoramento/page.tsx`, `app/dossie-juridico/page.tsx`, `app/alertas/AlertaCard.tsx`.
- **Contexto:** usuário pediu para continuar o Módulo 3 Jurídico; dos itens pendentes documentados (matriz de alertas sem configuração, emojis remanescentes, WhatsApp sem credencial), escolheu emojis remanescentes.
- **Mudanças:**
  - `monitoramento/page.tsx`: badge "🔒 Evidência lacrada" vira `<Lock size={12} strokeWidth={2} aria-hidden="true" />` + texto, dentro de `flex items-center gap-1`.
  - `dossie-juridico/page.tsx`: mesmo tratamento no badge "🔒 Lacrado em [data]".
  - `alertas/AlertaCard.tsx`: os dois avisos "⚠️ ..." (WhatsApp não configurado / falha de envio) viram `<AlertTriangle>`; o selo "✅ Encaminhado à Justiça Eleitoral..." vira `<CheckCircle2>` — trocada a estrutura de `<div>` com texto solto por `<div className="flex items-start gap-1.5">` + ícone (`mt-0.5 shrink-0` pra alinhar com texto de múltiplas linhas) + `<span>` com o conteúdo, já que esse bloco pode ter 2-3 linhas (data + nome + nota opcional), diferente dos badges de uma linha só.
- **Desvio da spec:** nenhum.
- **Testado (typecheck + navegador real contra staging):**
  1. `npx tsc --noEmit` na pasta `apps/web` — nenhum erro novo introduzido pelos 3 arquivos (o único erro presente, em `app/api/mensagens/enviar/route.ts`, é pré-existente e não foi tocado nesta entrega).
  2. `grep` de confirmação: 0 ocorrências de 🔒/⚠️/✅ restantes nos 3 arquivos.
  3. Navegador (staging, sessão já autenticada): registrei um item de teste em `/monitoramento` (categoria "Ameaça jurídica", gravidade "Alta", descrição `[TESTE] verificação visual de ícones — remover depois`) — gerou 2 alertas automaticamente (advogado_responsavel, coord_campanha), confirmando que o trigger da matriz de alertas continua funcionando. Em `/alertas`, inspecionei o DOM via JS e confirmei que o aviso "Envio por WhatsApp ainda não configurado" renderiza com `<svg class="lucide lucide-triangle-alert">` no lugar do emoji, layout (`flex items-center gap-1`) correto, sem erro de console.
  4. **Não testado visualmente:** o badge `Lock`/"Evidência lacrada" (precisa de um arquivo anexado pra calcular `hash_evidencia`, e a ferramenta de navegador usada não consegue dirigir o seletor de arquivo nativo do SO) e o selo `CheckCircle2`/"Encaminhado" (precisa do papel `advogado_responsavel`, que o usuário logado no momento não tinha). Nos dois casos, a mudança é sintaticamente idêntica ao padrão já testado em `PecaCard.tsx`/no próprio `AlertTriangle` desta entrega — risco residual baixo, mas registrado por transparência em vez de presumido como testado.
- **Limpeza:** item de teste e os 2 alertas gerados por ele foram removidos via `supabase db query --linked` (token de acesso fornecido pontualmente pelo usuário, uso único). Confirmado por contagem: `itens_restantes = 0`, `alertas_restantes = 0`. Usuário avisado para revogar o token.
- **Pendências para o Testador:** os 2 pontos "não testado visualmente" acima — não bloqueantes, mas vale conferir com dado real (upload de arquivo, sessão de advogado) quando possível.

---

## [2026-07-19] Auditoria de UX/UI — terceira rodada: grafite mais claro na sidebar + chips coloridos no dashboard (ref. specs.md mesma data)

- **Arquivos alterados:** `components/AppShell.tsx` (cor da sidebar), `app/dashboard/page.tsx` (chip colorido nos cards), `app/globals.css` (tentativa de token customizado adicionada e depois revertida — ver nota abaixo).
- **Contexto:** usuário achou o sistema visualmente simples e perguntou minha opinião sobre grafite + azul-marinho. Expliquei o risco partidário do azul-marinho (PSDB) e sugeri grafite + manter indigo; montei um artifact de mockup comparativo (Atual/Proposta) antes de mexer em código, ajustei o tom (usuário pediu "um ou dois tons mais claro") e só então implementei, depois de aprovação explícita ("Agora sim ficou mais elegante").
- **Mudanças técnicas:**
  - Sidebar: `border-neutral-800 bg-neutral-900` → `border-[#3a414d] bg-[#232830]`; hover de item de nav e do botão de fechar (mobile) de `neutral-800/60`/`neutral-800` → `[#2c323c]/60`/`[#2c323c]`. Cores exatas herdadas do mockup aprovado no artifact.
  - **Achado técnico durante a implementação:** a primeira tentativa foi registrar essas cores como tokens novos em `@theme inline` no `globals.css` (`--color-graphite-950` etc.), pra poder usar classes nomeadas (`bg-graphite-950`). Não funcionou sem reiniciar o servidor dev — confirmei por JS no navegador (`document.styleSheets`) que nenhuma regra `.bg-graphite-950` existia depois do hot-reload. Em vez de reiniciar o servidor do usuário só por isso, troquei pra valores arbitrários do Tailwind (`bg-[#232830]`), que funcionam imediatamente via JIT sem precisar de registro prévio no tema — removi a tentativa de token customizado do `globals.css` pra não deixar código morto.
  - Dashboard: cards passam de `rounded-lg border border-neutral-200 bg-white p-4` (ícone solto em `text-neutral-400`) pra `rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm shadow-neutral-900/5`, com o ícone dentro de um chip (`h-8 w-8 rounded-lg`) tintado — `bg-indigo-50 text-indigo-600` em 5 dos 6 cards, `bg-amber-50 text-amber-700` só em "Alertas pendentes" (cor semântica de atenção, não o acento do sistema — mesma lógica de separação já usada no resto do app entre indigo/acento e amber/aviso).
- **Desvio da spec:** nenhum, além do ajuste técnico já descrito (token customizado → valor arbitrário).
- **Testado (typecheck + navegador real contra staging):**
  1. `npx tsc --noEmit` — sem erro novo (mesmo erro pré-existente de sempre em `mensagens/enviar/route.ts`, não tocado).
  2. Navegador: confirmei por `getComputedStyle` que `aside` renderiza `rgb(35, 40, 48)` (= `#232830`) depois da correção do token pra valor arbitrário; `border-radius` do card = `12px` (`rounded-xl`); chip com `background-color`/`color` tintados presentes no DOM.
  3. Screenshot em 1280×800: sidebar grafite visível, item "Dashboard" ativo em indigo, 6 cards com chip colorido (5 indigo, 1 âmbar em "Alertas pendentes"), sombra suave, sem regressão de layout.
  4. Sem erro de console.
- **Pendências para o Testador:** nenhuma bloqueante. Extender o chip colorido pra outras telas (eleitores/apoiadores/lideranças) fica pra quando o usuário pedir — não foi assumido aqui.

---

## [2026-07-19] Calendário eleitoral com prazos TSE (ref. specs.md mesma data)

- **Arquivos:** `supabase/migrations/0028_calendario_eleitoral.sql` (novo), `app/calendario-eleitoral/page.tsx` (novo), `components/AppShell.tsx` (item de menu no grupo Jurídico, ícone CalendarClock), `app/dashboard/page.tsx` (banner "Próximo prazo" — entregue junto com a reescrita do dashboard evolutivo, mesma tela).
- **Decisões técnicas:**
  - `prazos_eleitorais` sem `campanha_id`, SELECT gated por `current_papel() IS NOT NULL` (usuário revogado não passa — `current_papel()` exige `status='ativo'` desde a 0023). Nenhuma policy de escrita; seed na própria migration.
  - Cálculo de "faltam N dias" feito em dias de calendário (parse manual de `YYYY-MM-DD` pra data local, não `new Date(iso)` direto — evita o clássico off-by-one de timezone com DATE puro).
  - Datas de resolução anual seedadas com "CONFERIR" explícito na descrição — visível pro usuário final de propósito, não só em comentário de código.
- **Desvio da spec:** banner do dashboard foi commitado junto com a entrega "Dashboard evolutivo" (mesmo arquivo) — conteúdo idêntico ao especificado.
- **Pendências para o Testador:** migration 0028 ainda não aplicada em staging (aguardando token); conferência das datas de resolução anual contra a Resolução oficial do Calendário Eleitoral 2026 segue obrigatória (critério de aceite).

---

## [2026-07-19] Agenda de campanha — eventos territoriais (ref. specs.md mesma data)

- **Arquivos:** `supabase/migrations/0029_agenda_campanha.sql` (novo — enums `tipo_evento_campanha`/`status_evento_campanha`, tabelas `eventos_campanha` + `eventos_liderancas`), `app/agenda/page.tsx`, `app/agenda/EventoForm.tsx`, `app/agenda/EventoCard.tsx` (novos), `components/AppShell.tsx` (item "Agenda" no grupo Gestão, entre Tarefas e Mapa, ícone CalendarDays).
- **Decisões técnicas:**
  - Junção `eventos_liderancas` herda o tenant via `EXISTS` no evento — toda policy passa pelo evento da própria campanha; escrita só `coord_campanha`, conforme spec.
  - **Edição reconcilia lideranças por diff** (remove desmarcadas, insere novas) em vez de apagar tudo e recriar — preserva a presença (`compareceu`) já registrada de quem permanece no evento.
  - Fluxo "marcar realizado": atualiza status + público estimado no evento e `compareceu` linha a linha na junção (updates sequenciais; sem RPC — volume por evento é pequeno).
  - Avisos TSE no form e no card: ato de rua (caminhada/comício/carreata) antes de 16/08/2026 → aviso âmbar citando art. 36-A; tipo comício → lembrete de showmício vedado (art. 39 §7º). Não bloqueiam, conforme spec.
  - Evento passado ainda planejado/confirmado ganha destaque âmbar "pendente de atualização".
  - Filtros por status/território via form GET puro (server component, sem estado client).
- **Desvio da spec:** nenhum.
- **Pendências para o Testador:** migration 0029 não aplicada em staging; teste ponta-a-ponta (criar → vincular lideranças → marcar realizado com presença) pendente de navegador; isolamento cross-tenant e bloqueio de escrita pra papel não-coordenação pendentes de teste real.

---

## [2026-07-19] Dashboard evolutivo — painel executivo (ref. specs.md mesma data)

- **Arquivos:** `app/dashboard/page.tsx` (reescrito — mantém os 6 cards e soma banner de prazo + 4 seções).
- **Decisões técnicas:**
  - Sem lib de gráfico: barras em divs com altura/largura por style inline; semanas sem cadastro mantêm a coluna com rótulo (barra zero, eixo íntegro — critério da spec).
  - Agregação no server component: `cidadaos` traz `created_at, circulo, estagio, territorio_id` (uma consulta serve 3 seções); apoiadores/lideranças só `created_at >= início da janela de 8 semanas`. Sem RPC nova, conforme spec.
  - Semana começa na segunda (padrão BR): `inicioSemana()` normaliza com `(getDay()+6)%7`.
  - Cobertura por território cruza contagem de eleitores com `votos_disponiveis_estimados` (campo existente nunca usado até aqui) — mostra "% do alvo" só quando a estimativa existe; barra limitada visualmente a 100%.
  - Cores das séries/temperatura (indigo/sky/emerald/rose/amber) são semântica interna de dado, não acento de marca — sem conflito com a régua de neutralidade partidária (nenhuma cor identifica legenda).
  - Papéis sem SELECT numa tabela veem a seção zerada/vazia sem erro — mesmo contrato do dashboard antigo (RLS decide, tela não tem lógica por papel).
- **Desvio da spec:** banner "Próximo prazo" (spec do calendário) entregue aqui por ser o mesmo arquivo.
- **Pendências para o Testador:** validar os números contra SQL direto (critério da spec); testar sessão de `candidato`; o banner de prazo só aparece depois da 0028 aplicada.

---

## [2026-07-19] Busca global de pessoas (ref. specs.md mesma data)

- **Arquivos:** `components/AppShell.tsx` (campo de busca no header — form controlado, submit navega pra `/busca?q=`), `app/busca/page.tsx` (novo, server component).
- **Decisões técnicas:**
  - Sanitização do termo antes do filtro `or(...ilike...)` do PostgREST: escapa `%`/`_` (curingas do ILIKE) e remove `,`/`(`/`)` (separadores da sintaxe do próprio `or()` — sem isso, termo com vírgula quebraria a query).
  - Telefone: além do termo bruto, se houver ≥ 4 dígitos a busca compara a variante só-dígitos contra whatsapp/telefone. Limitação registrada: se o telefone foi salvo com espaços/máscara no meio, a variante só-dígitos não casa (PostgREST não permite normalizar a coluna no filtro sem RPC) — os telefones do sistema são salvos contínuos (`+5581...`), então o caso comum funciona.
  - Nenhum log do termo de busca em lugar nenhum (atenção de LGPD registrada na spec — evitar trilha "quem procurou quem").
  - Header mobile: o nome da campanha ficou `hidden sm:block` pra dar espaço ao campo de busca — desvio pequeno de layout, registrado aqui; se o usuário sentir falta, dá pra voltar com truncamento mais agressivo.
- **Desvio da spec:** nenhum além do layout mobile acima.
- **Pendências para o Testador:** teste com sessão real de papel restrito (embaixador) pra confirmar que a RLS filtra resultados; busca por telefone com e sem máscara.

---

## [2026-07-20] Comunicação: biblioteca de mensagens aprovadas + central de avisos internos (ref. specs.md mesma data)

- **Arquivos:** `supabase/migrations/0032_comunicacao_modelos_avisos.sql` (novo — 2 enums, 2 tabelas de modelos, 2 tabelas de avisos, 4 triggers), `app/modelos-mensagem/{page.tsx,ModeloForm.tsx,ModeloCard.tsx}` (novos), `app/avisos/{page.tsx,AvisoForm.tsx,AvisoCard.tsx}` (novos), `components/AppShell.tsx` (2 itens novos no grupo Comunicação: "Modelos de mensagem" ícone `BookMarked`, "Avisos internos" ícone `Radio`).
- **Confirmado com o usuário antes de implementar:** a biblioteca de mensagens NÃO se integra ao envio de `/mensagens` — é catálogo de referência isolado, sem gatilho de disparo.
- **Decisões técnicas:**
  - `modelos_mensagem`: versionamento por trigger (`bump_versao_modelo_mensagem`) — editar `conteudo` incrementa `versao` e derruba `status` de volta pra `rascunho` automaticamente, limpando `aprovado_por`/`aprovado_em`. Sem isso, a aprovação do marketing viraria decorativa (qualquer edição pós-aprovação continuaria "aprovada" sem revisão nova).
  - Segundo trigger (`restringir_aprovacao_modelo_mensagem`) trava aprovação a `coord_campanha`/`coord_marketing` no próprio banco — RLS de UPDATE não distingue qual coluna mudou dentro do mesmo comando, mesmo racional de `restringir_encaminhamento_alertas` (migration 0017).
  - `avisos_internos` é **tabela nova, desacoplada de `alertas`** (que segue existindo exatamente como está) — `alertas` tem `monitoramento_item_id NOT NULL` e campos de encaminhamento jurídico que não fazem sentido pras 12 categorias operacionais pedidas (reunião convocada, nova tarefa, etc.).
  - Leitura por pessoa via `avisos_internos_lidos` (aviso_id, usuario_id, lido_em) em vez de um `lido_em` único na linha — um aviso "pra todos" marcado como lido por uma pessoa não pode esconder ele de quem ainda não abriu (diferente de `alertas`, que sempre teve audiência pequena e fixa).
  - 2 gatilhos automáticos de bônus (mesmo padrão de `gerar_alertas_ameaca_grave`): peça de conteúdo nova em rascunho gera 1 aviso por papel aprovador (advogado_responsavel, assistente_juridico, coord_campanha, coord_marketing); usuário revogado gera aviso pra coord_campanha. As outras 10 categorias nascem manuais nesta entrega (ver specs.md pro raciocínio de escopo).
- **Desvio da spec:** nenhum.
- **Testado em staging (sessão SQL simulada, dados de teste limpos ao final):**
  - Redator cria modelo (rascunho, v1) — OK.
  - Redator tentando aprovar → bloqueado pelo trigger com mensagem clara (`P0001`) — confirmado.
  - Coord_marketing aprova → OK, status vira aprovado.
  - Editar conteúdo do modelo aprovado → versão sobe pra 2, status volta pra rascunho, aprovado_por/em limpos — confirmado automático, sem intervenção da aplicação.
  - Inserir peça de conteúdo em rascunho → gerou os 4 avisos automáticos (1 por papel aprovador) — confirmado.
  - Revogar usuário (como coord_campanha, com AAL2/MFA simulado — a policy de UPDATE de `usuarios_internos` exige `mfa_verificado()`, então a simulação de sessão SQL precisou incluir `request.jwt.claims` com `aal: aal2`, não só o `sub`) → gerou aviso "Acesso revogado" pra coord_campanha — confirmado.
- **Pendências para o Testador:** teste de navegador ponta a ponta (criar/aprovar modelo, publicar aviso, marcar como lido) ainda não feito — só verificado via simulação SQL direta contra staging.
- **Nota de ambiente:** durante esta sessão o Bash tool ficou com PATH degradado (sed/wc/head/npx não encontrados); typecheck e push de migration precisaram rodar via PowerShell em vez de Bash. Git continuou funcionando normalmente em ambos.

---

## [2026-07-22] Conferência do calendário eleitoral contra Resolução TSE nº 23.760/2026 (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0039_calendario_eleitoral_conferido.sql` (novo).
- **Decisões técnicas:**
  - Migration de UPDATE nos 3 registros com "CONFERIR" (propaganda rádio/TV início/fim, prestação de contas parcial) — remove texto de conferência e atualiza `fonte` para o número oficial da resolução.
  - 4 INSERTs de prazos novos: fechamento cadastro eleitoral (07/05), obrigação de informar recursos financeiros (20/07), propaganda rádio/TV 2º turno início (09/10) e fim (23/10).
  - Fontes conferidas contra: página oficial "Eleições 2026: confira as principais datas do calendário eleitoral" (tse.jus.br) e texto da Resolução nº 23.760/2026.
- **Desvio da spec:** nenhum.
- **Testado:** migration aplicada em staging, `SELECT` confirmou 14 prazos sem nenhum "CONFERIR" nas descrições.

---

## [2026-07-22] Sistema de permissões delegáveis — migration 0040 + frontend (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0040_permissoes_delegaveis.sql` (novo — core do sistema), `apps/web/app/funcoes/{page.tsx,FuncaoForm.tsx,FuncaoCard.tsx}` (novo — tela de gestão de funções), `apps/web/app/usuarios/InviteUserForm.tsx` (dropdown de função no convite), `apps/web/app/api/usuarios/invite/route.ts` (aceita `funcao_id`), `apps/web/components/AppShell.tsx` (link "Funções e permissões" na sidebar).
- **Decisões técnicas:**
  - `funcoes_campanha` — funções customizáveis por campanha, com flag `sistema` para as 10 funções padrão criadas automaticamente. Coordenador de campanha é o único que pode criar/editar funções.
  - `permissao_sistema` — enum com 22 permissões agrupadas em 5 categorias (Cadastros, Comunicação, Jurídico, Campo, Administração).
  - `funcao_permissoes` — tabela de junção função↔permissão, com RLS: leitura para todos os membros ativos, escrita só para coord_campanha.
  - `has_permission(p permissao_sistema)` — função SECURITY DEFINER central. `coord_campanha` sempre retorna `true`. Para outros papéis: se o usuário tem `funcao_id`, consulta `funcao_permissoes`; senão, fallback para mapeamento legado papel→permissões (backward-compatible, zero downtime).
  - ~50 policies de RLS existentes migradas de `current_papel() IN (...)` para `has_permission('...')` — a semântica não muda para nenhum usuário existente (backfill garante), mas agora é configurável.
  - 2 triggers atualizados (`restringir_aprovacao_pecas_conteudo`, `restringir_aprovacao_modelo_mensagem`) para usar `has_permission()` em vez de lista fixa de papéis.
  - `criar_funcoes_padrao(p_campanha_id)` cria as 10 funções padrão com permissões corretas; chamada pelo `bootstrap_campanha()` e pelo backfill de campanhas existentes.
  - Backfill: campanhas existentes recebem funções padrão; usuários existentes são vinculados à função correspondente ao seu papel via UPDATE.
  - Controles não-delegáveis (editar campanha, gerenciar equipe, encaminhar à Justiça Eleitoral, enviar mensagem a eleitor, vincular cidadão a apoiador) permanecem hardcoded na `has_permission()` e nos triggers existentes — não entram no enum de permissões.
  - Frontend: `/funcoes` lista funções com contagem de permissões/membros, cards expandíveis com checkboxes por grupo, edição inline (marcar/desmarcar todas), criação de função customizada, exclusão de função não-sistema. Dropdown de função no formulário de convite de usuário com fallback "automática pelo papel".
- **Migration 0040 aplicada em staging sem erro.**
- **Desvio da spec:** nenhum.
- **Pendências para o Testador:** teste de navegador ponta a ponta (criar função customizada, editar permissões, convidar usuário com função) bloqueado por falta de login configurado. Teste de SQL (simulação de `has_permission()` com diferentes funcao_id) recomendado.

---

## [2026-07-24] Peças de conteúdo — geração de texto IA + arte programática (4 passos)

- **Arquivos alterados:**
  - `supabase/migrations/0041_fotos_campanha_conteudo_peca.sql` (novo — APLICADO ao staging)
  - `apps/web/app/campanha/FotosCampanha.tsx` (novo — upload/preview de fotos do candidato)
  - `apps/web/app/campanha/page.tsx` (seção "Fotos e logotipos")
  - `apps/web/app/pecas-conteudo/PecaForm.tsx` (reescrito — campo foco, textarea de conteúdo, botão "Gerar com IA")
  - `apps/web/app/pecas-conteudo/PecaCard.tsx` (campo conteudo, novos formatos, UI de geração de arte)
  - `apps/web/app/pecas-conteudo/page.tsx` (conteudo no select, podeCriar no PecaCard)
  - `apps/web/app/api/pecas/gerar-arte/route.tsx` (novo — gera PNG programático via satori + resvg)

- **Decisões técnicas:**
  - **Passo 1 (migration 0041):** tabela `fotos_campanha` com 6 tipos (foto_oficial, foto_campanha, foto_corpo_inteiro, logo_campanha, logo_partido, fundo_padrao), UNIQUE(campanha_id, tipo). Campo `conteudo TEXT` em `pecas_conteudo` (o texto gerado pela IA). Bucket `fotos-campanha` privado com RLS por pasta (campanha_id).
  - **Passo 2 (fotos):** grid de 6 tipos com upload, preview (signed URL), replace e delete. Upsert pattern no storage. Só `coord_campanha` edita.
  - **Passo 3 (IA no form):** botão "Gerar com IA" chama `/api/marketing/sugestao` existente, preenche o campo de conteúdo e marca `usou_ia`. Prompt usa o foco (tema) informado + base de conhecimento da campanha.
  - **Passo 4 (arte programática):** 5 templates (post_instagram 1080×1080, stories 1080×1920, whatsapp 800×800, facebook 1200×630, twitter 1200×675). Usa satori (JSX→SVG) + @resvg/resvg-js (SVG→PNG) — sem binário nativo, sem dependência de Sharp. Layout: faixa de cor + foto oficial em círculo + texto resumido + rodapé com número/nome/partido/CNPJ. Foto e logo vêm de `fotos_campanha`; se não tiver foto, mostra placeholder com a inicial do nome de urna. Cor primária escolhida pelo usuário (color picker). PNG retornado inline, com preview e download no card.
  - **Decisão de NÃO usar IA pra imagem:** peça eleitoral tem obrigações legais pixel-perfect (número do candidato, CNPJ, nome de urna) que geração de imagem por IA não garante. Templates programáticos são auditáveis e reprodutíveis.

- **Desvio da spec:** nenhum — os 4 passos seguem o plano aprovado na sessão.
- **Pendências para o Testador:** teste de navegador bloqueado por login. Verificar: (1) upload de foto em `/campanha`, (2) geração de texto IA em PecaForm (requer ANTHROPIC_API_KEY), (3) geração de arte PNG em PecaCard (requer foto_oficial ou aceitar placeholder).

---

## [2026-07-24] Operação de campo — GPS no cadastro de eleitor + heatmap no mapa

- **Arquivos alterados:** `apps/web/app/cidadaos/CidadaoForm.tsx` (captura GPS), `apps/web/app/geolocalizacao/MapaCobertura.tsx` (heatmap + 3 modos de visualização), `apps/web/types/leaflet.heat.d.ts` (novo — declaração de tipos), `apps/web/package.json` (+ `leaflet.heat`).
- **Contexto:** primeira entrega do módulo de operação de campo — captura de geolocalização no cadastro + mapa de calor. Sem migration nova — `cidadaos.geom GEOGRAPHY(POINT, 4326)` já existia desde a migration 0001, com GIST index e `mapa_eleitores()` RPC retornando lat/lng. Só faltava preencher.
- **Decisões técnicas:**
  - **GPS via `navigator.geolocation.getCurrentPosition`** com `enableHighAccuracy: true`. Botão "Capturar GPS" no formulário de eleitor — mostra coordenadas capturadas ou mensagem de erro (permissão negada, timeout). Botão "Limpar" pra remover. Salvamento como `POINT(lng lat)` direto no INSERT de `cidadaos.geom` (PostGIS WKT).
  - **Heatmap via `leaflet.heat`** (5kb, sem dependência pesada). 3 modos de visualização via radio buttons: Oculto (padrão), Mapa de calor, Pontos (comportamento anterior). `HeatLayer` é um componente React que usa `useMap()` do react-leaflet + `L.heatLayer()` — adiciona/remove o layer via `useEffect` cleanup.
  - **Sem migration nova.** Nenhuma mudança de schema — `cidadaos.geom` e `mapa_eleitores()` já cobriam tudo.
- **Testado no navegador (dev local, contra staging):** botão de GPS renderiza no form, radio buttons de visualização renderizam no mapa com "0 com GPS" (correto — nenhum eleitor com coordenada ainda), mapa de Cambé com círculo de território. Zero erros de console.
- **Desvio da spec:** nenhum.
- **Pendências para o Testador:** (1) cadastrar eleitor com GPS real (requer HTTPS ou localhost no celular), (2) verificar heatmap com dados reais (precisa de eleitores com `geom` preenchido).

---

## [2026-07-24] Briefing Diário do Candidato — migration 0042 + rota + dashboard (ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0042_briefing_diario.sql` (novo — NÃO aplicado ao staging ainda, ver pendências), `apps/web/lib/anthropic.ts` (novo prompt `SISTEMA_BRIEFING_DIARIO`), `apps/web/app/api/briefing/route.ts` (novo), `apps/web/app/dashboard/BriefingDiario.tsx` (novo), `apps/web/app/dashboard/page.tsx` (seção do briefing no topo + 3 consultas novas no Promise.all).
- **Decisões técnicas:**
  - Tabela `briefings_diarios` sem UNIQUE por data (histórico preservado; UI mostra o mais recente do dia) e sem policy de UPDATE/DELETE — geração de IA é imutável, mesmo padrão de `sugestoes_conteudo`.
  - INSERT permitido para papel `candidato` OU `has_permission('usar_ia')` — primeira tabela que integra o papel candidato ao sistema de permissões delegáveis da 0040.
  - Rota: se não há evento hoje, retorna `{semEventos: true}` sem chamar a Anthropic — sem custo e sem briefing vazio inventado.
  - Demandas entram TODAS (50 mais recentes) no contexto em vez de filtro SQL por região — `demandas_observadas.regiao/cidade` é texto livre e `territorios.nome_bairro` nem sempre bate; o prompt exige que o modelo priorize a região do evento e cite a origem quando usar demanda de outra região. Filtro textual frágil trocado por instrução explícita + auditoria do contexto.
  - Contexto enviado é resumido em `contexto_usado` (contagens) para auditoria, como nas demais gerações.
- **Verificado:** `npx tsc --noEmit` passou sem erro.
- **Desvio da spec:** nenhum.
- **Pendências:**
  - **Migration 0042 aplicada em staging** (2026-07-25 01:09 via `npx supabase db push --linked`, após `supabase login`).
  - **`.env.local` reconstruído** (2026-07-25): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy) e `SUPABASE_SERVICE_ROLE_KEY` (legacy) restauradas via Add-Content preservando a `ANTHROPIC_API_KEY`. **Chaves foram expostas em chat — rotacionar quando possível.**
  - Teste de navegador ponta a ponta (gerar briefing com evento real na agenda) pendente — usuária optou por empilhar Dia 4 antes de testar.

---

## [2026-07-25] Central de Copywriting e Adaptação de Mensagens — migration 0043 + rota + UI (Dia 4, ref. specs.md mesma data)

- **Arquivos alterados:** `supabase/migrations/0043_adaptacoes_mensagem.sql` (novo — APLICADO ao staging), `apps/web/lib/anthropic.ts` (novo prompt `SISTEMA_ADAPTADOR_MENSAGEM`), `apps/web/app/api/marketing/adaptar/route.ts` (novo), `apps/web/app/marketing/AdaptarForm.tsx` (novo — client component), `apps/web/app/marketing/page.tsx` (nova seção "Adaptar mensagem" + histórico agrupado por lote_id).
- **Decisões técnicas:**
  - Tabela `adaptacoes_mensagem` com `lote_id UUID` (sem FK — gerado no servidor via `randomUUID()`) para agrupar as N variações da mesma mensagem-mãe geradas juntas. Uma linha por variação (mensagem central duplicada em todas as linhas do lote — leve redundância pra evitar tabela pai e simplificar consultas).
  - RLS unificada em `has_permission('usar_ia')` — mesma permissão que já governa os demais geradores de IA (sugestões, análise, resposta). Papel `candidato` não gera (pra ele o valor está no briefing do Dia 1).
  - Rota chama a Anthropic em **paralelo** (uma call por variação) — falha isolada em uma variação não derruba as outras, e as falhas voltam com o erro específico pra UI mostrar em bloco separado.
  - Limites duros no cliente e no servidor: mensagem central ≤4000 chars, ≤6 adaptações por lote — evita explosão de custo/token num único clique.
  - 6 combos pré-definidos (WhatsApp/idosos, Instagram/jovens, Reel/jovens, e-mail/empresários, fala presencial, WhatsApp/trabalhadores) + campo custom (público+canal). Adicionar novos combos é uma linha em `COMBOS_PRE`, sem migration.
- **Verificado:** `npx tsc --noEmit` passou sem erro; migration 0043 aplicada em staging via `supabase db push --linked` sem erro.
- **Desvio da spec:** nenhum.
- **Pendências para o Testador:** teste de navegador ponta a ponta ainda não feito. Será feito em conjunto com o Dia 1 (briefing) na próxima sessão. Verificar: (1) usuária com papel `coord_marketing`/`redator_marketing` vê a nova seção; (2) mensagem central + 2–3 combos → variações mantêm a essência sem inventar dados; (3) botão de copiar funciona; (4) falha parcial (ex.: ANTHROPIC_API_KEY revogada temporariamente) mostra bloco amarelo.

---

## [2026-07-25] Público-alvo e regiões prioritárias nos temas da campanha — migration 0044 + helper + UI + 5 rotas IA

- **Arquivos alterados:** `supabase/migrations/0044_temas_publico_regioes.sql` (novo — APLICADO ao staging), `apps/web/lib/anthropic.ts` (novo helper `montarContextoConhecimento` + tipo `TemaComItens`), `apps/web/app/base-conhecimento/TemaDetalhes.tsx` (novo — componente de edição tag-input), `apps/web/app/base-conhecimento/page.tsx` (integra TemaDetalhes + busca novas colunas), `apps/web/app/api/briefing/route.ts`, `apps/web/app/api/marketing/sugestao/route.ts`, `apps/web/app/api/marketing/adaptar/route.ts`, `apps/web/app/api/marketing/analise/route.ts`, `apps/web/app/api/marketing/resposta/route.ts` (todas as 5 rotas IA agora buscam temas agrupados com público-alvo e regiões).
- **Decisões técnicas:**
  - Colunas `publicos_alvo TEXT[]` e `regioes_prioritarias TEXT[]` direto em `temas_campanha` (arrays Postgres), sem tabela extra — listas curtas (~5-10 itens por tema), consumidas como texto nas prompts.
  - Helper `montarContextoConhecimento()` centraliza a formatação: agrupa itens por tema, exibe "Público-alvo: X, Y | Regiões prioritárias: A, B" como subcabeçalho de cada tema. Todas as 5 rotas IA usam o mesmo helper em vez de cada uma formatar independentemente.
  - Query mudou de `base_conhecimento_itens.select("titulo, descricao")` para `temas_campanha.select("..., base_conhecimento_itens(titulo, descricao)")` — join via FK reversa, traz tudo agrupado por tema numa única query.
  - UI: componente `TemaDetalhes` com tag-input (Enter ou botão +, clique em x pra remover), botão "Salvar" aparece só quando há mudança, usa `supabase.update()`. Quem não pode editar vê os valores como texto simples.
- **Verificado:** `npx tsc --noEmit` passou sem erro; migration 0044 aplicada em staging.
- **Desvio da spec:** não havia spec prévia — funcionalidade pedida pela usuária durante a sessão.

---
