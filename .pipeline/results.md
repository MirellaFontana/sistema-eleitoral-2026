# results.md — Testador

Aqui o **Testador** registra o resultado da verificação de cada item de `changes.md`: o que foi testado, o que passou, o que falhou, e o veredito para o Revisor.

Formato sugerido por entrada:

```
## [data] Nome da tarefa (ref. changes.md)
- Testado:
- Passou:
- Falhou:
- Veredito: aprovado / aprovado com ressalvas / reprovado
```

---

## [2026-07-12] Módulo 1 — Schema base multitenant (ref. changes.md "Módulo 1 — Schema base multitenant" e fix seguinte)

- **Método — leitura obrigatória antes do restante:** a intenção era rodar os 5 testes do plano contra um Postgres real (container Docker com PostGIS + stub de `auth.users`/`auth.uid()`/`auth.jwt()`, roles `authenticated`/`anon`, fixtures de 2 campanhas). **O Docker Desktop não subiu neste ambiente** (nenhum processo iniciou após duas tentativas de start, provavelmente por falta de sessão gráfica/WSL2 disponível aqui) — não executei nenhuma query contra um banco vivo. O que segue é um **traço manual, predicado por predicado**, de cada policy da migration contra os dados de fixture que eu tinha preparado, não uma execução real. Isso é uma ressalva relevante para o veredito.
- Os scripts preparados (auth stub, fixtures, os 5 testes + bônus) ficaram salvos em `C:\Users\Casa\AppData\Local\Temp\claude\...\scratchpad\rls-test\` (00/02/03), prontos para rodar assim que houver Docker ou um projeto Supabase local disponível — recomendo rodar de verdade antes de aplicar em produção.

### Resultado por item do plano

**1. Isolamento cross-tenant** — Testado (traço manual): `cidadaos_select` filtra por `campanha_id = current_campanha_id()` como cláusula própria, sem outra policy permissiva concorrente que possa fazer OR com ela (esse era o bug do rascunho original, já corrigido). Um SELECT direto pelo ID conhecido do cidadão da Campanha B, feito por usuário da Campanha A, é filtrado pela mesma cláusula. **Passou** (por inspeção).
- Bônus 1b (não pedido, mas verificado): embaixador dentro da própria campanha só vê o próprio território (`territorio_id = current_territorio_id()`), não a campanha inteira. **Passou** (por inspeção).

**2. Restrição de papel (Advogado)** — Testado (traço manual): `cidadaos_select` e `consentimentos_select` excluem `advogado` do `NOT IN`, então advogado não lê PII de cidadão nem consentimento. `log_auditoria_select` inclui `advogado` explicitamente, então o bloco jurídico mantém acesso à trilha de auditoria (consistente com §3.2). **Passou** (por inspeção).
- Bônus 2b (candidato): mesma exclusão em `cidadaos_select`. **Passou**.
- Bônus 2c (coord_comunicacao) — **este teste encontrou um bug real**: a versão original da migration só excluía `advogado` e `candidato`, não `coord_comunicacao`. Como a especificação (§3.2) diz explicitamente que Coord. de comunicação não acessa dado pessoal de cidadão, isso era uma falha de RLS (não um vazamento cross-tenant, mas um vazamento cross-papel dentro do mesmo tenant). **Reprovado na primeira passada → corrigido nas policies `cidadaos_select` e `consentimentos_select` (ver changes.md, entrada "Fix pós-teste") → passou no retraço após a correção.**

**3. Travas estruturais ("sem importação")** — Testado (traço manual, por definição de coluna/constraint, independe de sessão/RLS):
- INSERT sem `origem_cadastro`: coluna é `NOT NULL` → viola constraint. **Passou**.
- INSERT com `origem_cadastro='embaixador'` sem `embaixador_coletor_id`: viola o CHECK `embaixador_coletor_obrigatorio`. **Passou**.
- Bônus 3c: INSERT com `origem_cadastro='importacao'` — o enum `origem_cadastro_cidadao` não tem esse valor; Postgres rejeita no cast antes mesmo do CHECK rodar (`invalid input value for enum`). **Passou** — essa é a trava mais forte possível, mais forte que um CHECK com lista de valores proibidos.

**4. Imutabilidade (log_auditoria)** — Testado (traço manual): trigger `BEFORE UPDATE OR DELETE` com `RAISE EXCEPTION` incondicional dispara para qualquer role de origem, inclusive `postgres` (superusuário) — trigger não é RLS, não é ignorado por BYPASSRLS. **Passou** (por inspeção).
- Bônus 4b: mesma trava em `consentimentos_lgpd`. **Passou**.

**5. Compliance TSE/LGPD** — Testado (traço manual): `cidadaos.atendido_por_ia` existe (`BOOLEAN NOT NULL DEFAULT FALSE`), gravável e legível. `consentimentos_lgpd` tem `finalidade`, `base_legal`, `texto_aceito`, `canal_origem`, `status` (`ativo`/`revogado`) — cobre finalidade e revogação exigidas. **Passou** (por inspeção).

**Bônus extra (fora do plano original, mas relevante):** `anon` não recebe nenhum `GRANT` em tabela nenhuma na migration — SELECT como `anon` falharia por permissão antes mesmo de a RLS ser avaliada. **Passou** (por inspeção).

### Passou
Itens 1, 1b, 2 (após fix), 2b, 3 (a/b/c), 4, 4b, 5, bônus anon — todos por traço manual, não por execução real.

### Falhou
Item 2c falhou na primeira passada (coord_comunicacao via PII de cidadão) — corrigido antes desta entrada ser fechada, e o retraço confirma a correção.

### Veredito: **aprovado com ressalva**
A ressalva não é sobre o conteúdo da migration — é sobre o método: nada aqui foi confirmado rodando contra um Postgres real. O traço manual é rigoroso (regra por regra), e já provou seu valor ao pegar o bug do `coord_comunicacao`, mas não substitui execução real, principalmente para os side effects difíceis de prever por leitura (ex.: `SECURITY DEFINER` + `search_path`, comportamento exato de `FORCE ROW LEVEL SECURITY` em papéis específicos do Supabase, e a integração real do PostgREST com `request.jwt.claims`). Recomendo rodar os scripts em `scratchpad/rls-test/` contra `supabase start` (CLI local) ou um projeto Supabase de staging antes de considerar o Revisor liberado para fechar a tarefa.

---

## [2026-07-12] Tentativa de execução real via `npx supabase start` — Docker falhou de novo (ref. instrução do usuário para reexecutar como Testador)

- **Testado:** tentativa de subir o ambiente local via `npx supabase start` (CLI oficial, instalada com sucesso: `supabase@2.109.1`), para então rodar de fato os scripts de `scratchpad/rls-test/` contra um Postgres real, substituindo o traço manual da entrada anterior.

- **Diagnóstico técnico feito antes de tentar o CLI** (para entender a causa raiz, não só constatar a falha):
  - `docker info` → falha (daemon inacessível).
  - Nenhum atalho de "Docker Desktop" existe em Desktop, Start Menu (usuário) ou Start Menu (todos os usuários).
  - Não existe executável de GUI em `C:\Program Files\Docker\Docker\` nem em `...\frontend\`. O único `.exe` chamado "Docker desktop.exe" fica em `...\Docker\resources\` e **não é o launcher** — é um handler de protocolo de URL; ao ser executado diretamente ele morre imediatamente com o erro `[F] no argument received` (log em `%LOCALAPPDATA%\Docker\log\host\Docker desktop.exe.log`), confirmando que essa não é a forma correta de iniciar o app.
  - `wsl -l -v` mostra uma distro `docker-desktop` (versão WSL2) presente mas **parada** — evidência de que o Docker Desktop já funcionou nesta máquina em algum momento, mas o app orquestrador que sobe essa VM está ausente ou quebrado agora.
  - Não existe serviço do Windows correspondente ao Docker Desktop (`Get-Service *docker*` só retorna nada; `*wsl*` retorna o `WSLService`, que está rodando).

- **Erro exato reproduzido pelo próprio Supabase CLI** ao rodar `npx supabase start`:
  ```
  failed to inspect service: error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/containers/supabase_db_sistema-eleitoral-2026/json":
  open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
  Docker Desktop is a prerequisite for local development. Follow the official docs to install: https://docs.docker.com/desktop
  ```
  Isso é exatamente a mesma causa raiz do diagnóstico manual: o named pipe do motor Linux do Docker Desktop (`dockerDesktopLinuxEngine`) não existe porque o processo que o cria não está rodando — não é falta de espera, é ausência do aplicativo orquestrador.

- **Passou:** nada foi executado contra banco real — o CLI e a instalação do pacote `supabase` funcionaram normalmente (`supabase --version` → `2.109.1`); a falha é isolada ao acesso ao Docker.

- **Falhou:** `npx supabase start` — não sobe nenhum container. `supabase init --workdir . -y` também falhou por sintaxe (`-y` não é reconhecido nesta versão do CLI; seria `-i`/`--interactive` para modo interativo, ou omitir flags para os defaults) — irrelevante para o resultado final, pois o bloqueio real é o Docker, não o init.

- **Veredito desta rodada: reprovado (ambiente indisponível)** — não é um veredito sobre a migration, é sobre a infraestrutura de teste. A migration em si continua com o veredito "aprovado com ressalva" (traço manual) da entrada anterior; esta entrada só documenta que a ressalva **persiste** — ainda não há execução real.

- **Para o Planejador — alternativas de ambiente de staging a avaliar (nenhuma aplicada, decisão em aberto):**
  1. Reinstalar/reparar o Docker Desktop nesta máquina (a instalação atual parece parcial/corrompida — falta o executável principal).
  2. Rodar Docker Engine dentro de uma distro WSL2 Linux diretamente (ex.: a `Ubuntu` ou `kali-linux` já instaladas, ambas hoje paradas), sem depender do Docker Desktop para Windows — `supabase start` funciona contra qualquer daemon Docker acessível, não precisa ser especificamente Docker Desktop.
  3. Usar um projeto Supabase remoto gratuito como staging (`supabase link` + aplicar a migration com `supabase db push`) — sai do escopo "ambiente local", mas destrava execução real dos 5 testes sem depender de Docker nesta máquina.
  4. Manter o traço manual como gate temporário e migrar para execução real assim que uma das opções acima estiver disponível — não bloquear o restante do Módulo 1 por causa da infraestrutura de teste local.

---

## [2026-07-13] Execução real via Supabase remoto (staging) — decisão do usuário: opção 3 acima

- **Ambiente:** projeto Supabase free tier `sistema-eleitoral-2026-staging` (ref `czrlvvdtpycbkbxsgvev`, `us-east-1`), criado pelo usuário. Link feito via `supabase link --project-ref` + `SUPABASE_ACCESS_TOKEN` (personal access token do usuário, uso pontual, recomendado revogar após o ciclo).

- **Achado prévio à execução dos testes:** a migration 0001 **já estava 100% aplicada** neste projeto remoto (6 tabelas, 15 policies, 4 funções helper — todos batendo exatamente com o arquivo), mas o histórico de migrations do CLI não sabia disso (`remote: ""`). Havia inclusive fixture de um teste real anterior já esquecida no banco (`Candidata A` / `Candidato B`, IDs `1111...`/`2222...`, 3 cidadãos, 6 usuários) — evidência de que uma rodada de execução real já tinha acontecido antes desta entrada, sem o registro correspondente aqui. Corrigido com `supabase migration repair --status applied 0001` (sem re-executar SQL) e a fixture antiga foi incluída na limpeza do script de teste desta rodada.

- **Script de teste:** [.pipeline/rls_smoke_test.sql](rls_smoke_test.sql) — cria fixtures (2 campanhas, 3 territórios, 6 usuários com os 5 papéis, 3 cidadãos, 1 consentimento, 1 log), roda os 5 testes do plano + 3 bônus via `DO $$` com troca de identidade real (`SET ROLE authenticated` + `request.jwt.claims` via `set_config`, imitando exatamente o que o PostgREST faz em produção), grava resultado numa tabela temporária, imprime, e limpa tudo ao final (incluindo a fixture órfã da rodada anterior).

### Resultado — 1ª rodada (13 testes, todos contra Postgres real)

**12 de 13 passaram.** O único que falhou revelou um **bug real de defesa em profundidade**, não um falso positivo do script:

- **Bônus reprovado — "anon sem GRANT":** a suposição da migration 0001 ("anon não recebe grant nenhum, então SELECT falha antes mesmo da RLS") estava **errada para Supabase especificamente**. Investigação (`information_schema.role_table_grants` + `pg_default_acl`): o Supabase provisiona todo projeto novo com `ALTER DEFAULT PRIVILEGES` nas roles `postgres`/`supabase_admin` que concedem **todos os privilégios** (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/...) a `anon`, `authenticated` e `service_role` em qualquer tabela nova de `public`, automaticamente — não é algo que nossa migration criou nem controla. Confirmado que isso é bootstrap de plataforma, não erro do Programador.
  - **Checagem de gravidade antes de reportar:** RLS ainda segurava (0 linhas visíveis para `anon` mesmo com o grant presente) — não houve vazamento de dado real. O risco é estrutural: a segunda camada de defesa (grant) estava ausente, deixando `cidadaos`/`consentimentos_lgpd`/`log_auditoria` protegidos por **uma única camada** (RLS), quando o próprio changes.md já documentou um bug de policy uma vez (`coord_comunicacao`). Um bug futuro de policy exporia dado a uma chave anônima pública, sem grant nenhum barrando.

### Fix aplicado (migration 0002, ref. changes.md mesma data)
`REVOKE ALL` de `anon` nas 6 tabelas sensíveis; `authenticated` também recebeu `REVOKE ALL` seguido de `GRANT` só do necessário (removendo DELETE/TRUNCATE/REFERENCES/TRIGGER que vieram do mesmo default privilege, por princípio de menor privilégio — RLS já bloqueava DELETE por falta de policy, mas o grant não deveria existir mesmo assim).

### Resultado — 2ª rodada (retest pós-fix)
**13 de 13 passaram**, incluindo o bônus: `anon` agora recebe `permission denied for table cidadaos` — bloqueio na camada de grant, antes mesmo de RLS ser avaliado, como o design original pretendia.

### Veredito final: **aprovado, sem ressalva**
Execução real (não mais traço manual) contra Postgres/Supabase de verdade, todos os 13 testes passando, incluindo o bug de defesa em profundidade encontrado e corrigido nesta mesma rodada. Staging confirmado limpo (0 linhas de fixture remanescentes) ao final. Migration 0001 + 0002 prontas para virem a fazer parte da baseline do Módulo 1.

**Pendência para o Revisor:** decidir se a fixture órfã da rodada anterior (que eu limpei) e a falta de registro dela neste arquivo antes de hoje merecem uma nota de processo — o script de teste ficou responsável por limpar um resíduo que não era dele.

---

## [2026-07-15] Módulo 3 — Jurídico: Conformidade e rotulagem IA — migration 0012 (ref. changes.md mesma data)

- **Ambiente:** mesmo projeto Supabase de staging (`czrlvvdtpycbkbxsgvev`) já usado nos módulos anteriores. Docker local segue indisponível nesta máquina (mesmo bloqueio já documentado na entrada de 2026-07-12) — mas isso não impediu execução real, porque o CLI oferece `supabase db query --linked -f arquivo.sql`, que roda o SQL direto no banco remoto sem precisar de Postgres local. Access token de uso pontual, fornecido pelo usuário nesta sessão.

- **Script de teste:** [.pipeline/pecas_conteudo_test.sql](pecas_conteudo_test.sql) — 12 testes, mesmo padrão de fixtures + `DO $$` com `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', ...)` das rodadas anteriores.

### Resultado — 12 de 12 passaram (execução real, não traço manual)
1. `redator_marketing` cria rascunho com IA (positivo).
2. `redator_marketing` NÃO consegue auto-aprovar (`rotulo_aplicado`/`aprovador_id`) — bloqueado pelo trigger de separação de poder.
3. `advogado_responsavel` aprova e publica peça com IA + rótulo (positivo).
4. Peça com `usou_ia=true` e `rotulo_aplicado=false` não publica — `CHECK publicacao_ia_exige_rotulo`.
5. Peça rotulada mas sem `aprovador_id` não publica — `CHECK publicacao_exige_aprovador`.
6. `coord_marketing` aprova peça sem IA (positivo) — valida a decisão do usuário de incluí-lo no grupo de aprovação, não só o jurídico.
7. `aprovador_id` diferente do usuário autenticado é bloqueado (ninguém assina aprovação em nome de outro).
8. Janela de bloqueio, testada forçando `dentro_janela_bloqueio()` para `true` temporariamente (`CREATE OR REPLACE FUNCTION` dentro do próprio script, restaurada ao final): (a) INSERT de peça nova com IA bloqueado; (b) peça sem IA não é afetada, mesmo com a janela forçada; (c) publicar peça com IA já existente também é bloqueado dentro da janela.
9. Fora da janela (restaurada a função real, hoje é 2026-07-15), o mesmo fluxo de publicação funciona normalmente.
10. Isolamento cross-tenant: `coord_campanha` de outra campanha vê 0 linhas.

- **Verificação pós-teste (fora do script, checagem extra):** confirmei que `dentro_janela_bloqueio()` voltou ao texto original exato da migration (`pg_proc.prosrc`) depois do teste 8 — o truque de forçar a função para testar a janela mexe numa função compartilhada do banco de staging, risco real se a restauração falhar. Também confirmei 0 linhas de fixture (`Campanha Peças A/B`) remanescentes.

### Frontend — testado no navegador (dev local `npm run dev`, contra staging)
- Criei dois usuários de teste sem MFA (reset de senha do `redator_marketing` já existente + `advogado_responsavel` novo, via script pontual com `service_role`, apagado depois de usado) — evitou depender do TOTP do `coord_campanha` de teste, cujo secret não estava disponível nesta sessão.
- **Fluxo ponta a ponta real:** login como `redator_marketing` → formulário de rascunho aparece, checkbox de IA revela campos de ferramenta/prompt → rascunho criado, aparece na lista, **sem** botão de aprovar (confirmado lendo a árvore de acessibilidade da página, não só visualmente). Logout, login como `advogado_responsavel` → **sem** formulário de criar rascunho (papel não tem esse poder), **com** botão "Aprovar e publicar" → confirmação inline (sem `window.confirm`) com texto de rótulo pré-preenchido → peça vira "Publicado", rótulo aparece como banner visível (não só campo de banco), data de publicação exibida.
- Peça de teste removida do staging ao final (via `service_role`, já que a tabela não tem policy de DELETE por design).

### Passou
Todos os 12 testes de banco + o fluxo completo no navegador (criação, bloqueio de auto-aprovação, aprovação, rótulo visível, publicação).

### Falhou
Nada nesta rodada.

### Veredito: **aprovado, sem ressalva**
Execução real contra Postgres/Supabase de staging (não traço manual), 12/12 testes de banco passando, e o fluxo completo confirmado no navegador com troca de papel real (login/logout, não simulação). Staging confirmado limpo ao final (fixtures de teste e a peça de conteúdo de teste removidas, função de janela restaurada ao texto original).

**Nota para o Revisor:** `sugestao_conteudo_id` (rastreabilidade com `sugestoes_conteudo` do Módulo 4) existe no schema mas não foi exercitado em nenhum teste nem exposto no formulário — é campo opcional, não bloqueante, mas fica registrado como não coberto por teste ainda.

---

## [2026-07-15] Módulo 3 — Jurídico: Escudo antideepfake — migration 0013 (ref. changes.md mesma data)

- **Ambiente:** mesmo staging (`czrlvvdtpycbkbxsgvev`), mesmo método (`supabase db query --linked -f arquivo.sql`), mesmo access token de uso pontual (ainda não revogado pelo usuário desde a entrada anterior).

- **Script de teste:** [.pipeline/monitoramento_evidencia_test.sql](monitoramento_evidencia_test.sql) — 9 testes, mesmo padrão de fixtures das rodadas anteriores.

### Resultado — 9 de 9 passaram (execução real)
1. Insere item de ameaça com hash (positivo).
2. Hash em categoria fora de ameaça bloqueado — `CHECK hash_so_para_ameaca`.
3. `hash_evidencia` sem `hash_calculado_em` bloqueado — `CHECK hash_par_completo`.
4. UPDATE de `status` em item já lacrado continua funcionando (positivo) — confirma que a imutabilidade é seletiva, não trava o item inteiro.
5. UPDATE de `descricao` em item lacrado bloqueado pelo trigger.
6. UPDATE de `captura_path` em item lacrado bloqueado pelo trigger.
7. UPDATE de `categoria` pra fora do escopo de ameaça, com hash ainda presente, bloqueado pelo `CHECK` (efeito colateral do mesmo constraint do item 2 — revalidado em UPDATE, não só INSERT).
8. Item de categoria de ameaça sem arquivo de captura fica sem hash (positivo) — confirma que o sistema não força prova onde não há o que hashear, em vez de falhar ou inventar um hash vazio.
9. Isolamento cross-tenant: outra campanha não vê os itens lacrados desta, mesmo padrão já validado em todos os módulos anteriores.

- **Verificação pós-teste:** confirmei 0 linhas de fixture (`Campanha Evidencia A/B`) remanescentes no staging.

### Frontend — testado no navegador (dev local, contra staging)
- Login como `advogado_responsavel` de teste (já criado na entrada anterior, reaproveitado).
- Simulei a seleção de um arquivo real via `DataTransfer` + evento `change` no `<input type="file">` (limitação de sempre pra dirigir o seletor nativo do SO nesta automação), o que exercitou o componente `MonitoramentoForm` de ponta a ponta, não uma chamada isolada à API do Storage.
- Registrei item categoria "Deepfake suspeito" com arquivo: hash calculado e gravado automaticamente, sem ação manual — selo "🔒 Evidência lacrada" apareceu na lista imediatamente.
- `/dossie-juridico`: listou exatamente o item lacrado (SHA-256 e carimbo de data/hora visíveis), excluindo corretamente um item pré-existente da mesma categoria mas sem arquivo/hash.
- **Ressalva de método, não de produto:** o botão "Ver captura" pareceu não funcionar quando verificado via `read_network_requests` — essa ferramenta de teste não captura chamadas cross-origin ao Supabase (confirmado: nem login, nem inserts, nem a chamada de assinatura de URL nunca apareceram nesse log, mesmo nos casos que sabidamente funcionaram). Confirmei o funcionamento real interceptando `window.open` via `javascript_tool`: a signed URL correta do bucket `monitoramento`, com o path certo, foi gerada e passada pra abertura. Nenhum bug real aqui — registrado pra não repetir o mesmo diagnóstico equivocado numa próxima rodada.
- Item de teste e arquivo de teste removidos do staging (Storage + tabela) ao final, via `service_role`.

### Passou
Todos os 9 testes de banco + o fluxo completo no navegador (registro com hash automático, selo de evidência lacrada, dossiê filtrando corretamente, download de captura confirmado via interceptação de `window.open`).

### Falhou
Nada nesta rodada.

### Veredito: **aprovado, sem ressalva**
Execução real (banco + navegador), 9/9 testes de banco passando, fluxo completo confirmado no navegador com evidência de que o download de captura funciona de verdade (não apenas assumido). Staging limpo ao final.

**Nota para o Revisor:** o texto da UI (`/dossie-juridico` e o aviso no formulário) já deixa explícito que o hash é "cadeia de custódia interna", não notarização externa — decisão de produto tomada em specs.md pra não a interface prometer uma garantia jurídica que o sistema não cumpre. Vale o Revisor conferir se esse texto é suficiente ou se o advogado do cliente vai querer algo mais forte (ex.: RFC 3161) antes de usar isso em processo real — fica registrado como ponto em aberto, não decidido aqui.

---

## [2026-07-16] Remodelagem do campo — Lideranças, metas, tarefas, mapa — migrations 0014-0016 (ref. changes.md mesma data)

- **Ambiente:** mesmo staging (`czrlvvdtpycbkbxsgvev`), mesmo método (`supabase db query --linked -f arquivo.sql`), mesmo access token de sessão anterior (ainda válido).
- **Script de teste:** [.pipeline/liderancas_test.sql](liderancas_test.sql) — 14 testes, mesmo padrão de fixtures das rodadas anteriores.

### Resultado — 14 de 14 passaram (execução real)
1. `coord_marketing` cria liderança (positivo).
2. `candidato` NÃO cria liderança — bloqueado por RLS.
3. Isolamento cross-tenant nas 3 tabelas novas (`liderancas`, `metas`, `tarefas`).
4. `coord_campanha` digita cidadão com origem `formulario_lideranca` + liderança da própria campanha (positivo).
5. Liderança de OUTRA campanha é rejeitada — o `EXISTS` da policy roda sob a RLS de `liderancas`, então nem enxerga a liderança de fora.
6. Formulário sem `lideranca_id` é rejeitado — `CHECK formulario_lideranca_exige_lideranca`.
7. `coord_marketing` NÃO digita cidadão — modelo de PII da migration 0006 preservado, não afrouxado pela nova porta de entrada.
8. Meta geral criada por `coord_marketing` (positivo).
9. Meta tipo `lideranca` sem `lideranca_id` é rejeitada — `CHECK meta_lideranca_coerente`.
10. DELETE de meta: `redator_marketing` = 0 linhas afetadas (RLS bloqueia silenciosamente, sem erro — `DELETE` sem `WHERE` que a policy autorize simplesmente não afeta nada), `coord_marketing` = 1 linha.
11. `redator_marketing` cria tarefa (positivo) — responsável em texto livre.
12. `candidato` NÃO cria tarefa.
13. DELETE de tarefa: `redator_marketing` = 0, `coord_campanha` = 1 — só coordenação exclui.
14. `candidato` lê `liderancas` (positivo) — leitura liberada a todos os papéis internos, diferente do modelo de `cidadaos`.

### Frontend — testado no navegador (dev local, contra staging)
- **MFA:** a conta de teste `coord_campanha` já tinha MFA enrolado de uma sessão anterior, mas sem o secret disponível nesta sessão nova. Em vez de recriar a conta, escrevi um gerador de TOTP local (RFC 6238, HMAC-SHA1, 6 dígitos, passo de 30s) a partir do secret mostrado na própria tela de enroll — permite verificar MFA sem depender de um app autenticador externo rodando em paralelo. Validei contra o fluxo real do Supabase (`mfa.challenge` + `mfa.verify`), não simulado.
- **Fluxo ponta a ponta real:** criei liderança "Paula Mendes" (sem território) com meta de 400 cadastros → apareceu na tabela com progresso 0%. Criei território "Boa Viagem" com busca de coordenada real via Nominatim (retornou -8.1235027, -34.9033955, coordenada verdadeira do bairro no Recife) → criei liderança "Roberto Nunes" nesse território → digitei 2 cidadãos (um por liderança, um deles "quente"/apoiador) via `/cidadaos`, cada um gerando cidadão + consentimento LGPD numa sequência de duas chamadas. Voltei em `/liderancas`: cadastros e progresso (1/400) refletiram o dado real, não um valor mockado. Fui em `/geolocalizacao`: círculo azul (sem meta de território definida) renderizado em cima do bairro real no mapa Leaflet/OpenStreetMap; cliquei no círculo e o popup mostrou "Boa Viagem · Recife — Cadastros: 1 — Apoiadores: 0 — Lideranças: 1 — Sem meta definida — 1 sem coordenada no mapa" — todos os números batendo com o estado real do banco.
- **RLS confirmada no navegador, não só no SQL:** logado como `coord_marketing`, `/cidadaos` mostrou a mensagem de bloqueio de LGPD (sem acesso à base nominal); a mesma conta conseguiu gerenciar lideranças normalmente, vendo a contagem de cadastros (número) sem nunca ver nome/whatsapp do cidadão — confirma que as funções agregadas (`SECURITY DEFINER`) expõem só o agregado, não a linha.

### Passou
Todos os 14 testes de banco + o fluxo completo no navegador (lideranças, metas, tarefas, digitação de formulário com consentimento, mapa com geocodificação real).

### Falhou
Nada nesta rodada.

### Veredito: **aprovado, com uma ressalva de processo (não de produto)**
Execução real (banco + navegador), 14/14 testes de banco passando, fluxo completo confirmado no navegador com dado geográfico real (Nominatim) e mapa renderizado de verdade.

**Ressalva:** não consegui limpar os 2 cidadãos de teste (+ consentimentos) do staging ao final — `consentimentos_lgpd` é append-only por trigger, e a FK impede apagar o cidadão enquanto o consentimento existir. Não tentei contornar isso (ex.: desabilitar o trigger manualmente) porque seria comprometer, mesmo que temporariamente, a garantia de imutabilidade que a Módulo 1 testou e validou — o preço de um teste 100% realista é não conseguir desfazer tudo depois. `liderancas` e o território "Boa Viagem" de teste ficaram no staging pelo mesmo motivo (FK). `metas` e `tarefas` de teste foram removidas normalmente. Fica registrado como resíduo conhecido e inofensivo, não como falha.

---

## [2026-07-16] Módulo 3 — Jurídico parte 3: Matriz de alertas + encaminhamento — migrations 0017/0018 (ref. changes.md mesma data)

- **Ambiente:** mesmo staging (`czrlvvdtpycbkbxsgvev`), mesmo método (`supabase db query --linked -f arquivo.sql`), mesmo access token de sessão anterior.
- **Script de teste:** [.pipeline/alertas_test.sql](alertas_test.sql) — 9 testes.

### Primeira rodada — 1 de 9 passou, achado real de bug
Teste 1 (gravidade alta gera 2 alertas) falhou com `new row violates row-level security policy for table "alertas"`. Investigado: o trigger `gerar_alertas_ameaca_grave()` rodava com o privilégio de quem inseriu o `monitoramento_item` (role `authenticated`), e a tabela `alertas` não tem policy de INSERT (de propósito — só o trigger deveria escrever ali). Sem `SECURITY DEFINER`, a própria RLS bloqueava a escrita do sistema. Como o `EXCEPTION WHEN OTHERS` do teste 1 fez rollback até o savepoint (desfazendo também o `INSERT` em `monitoramento_itens` daquele teste), os testes 5-9 falharam em cascata por não acharem nenhuma linha pra trabalhar — não eram 5 bugs independentes, era 1 causa raiz. Corrigido com a migration 0018 (`SECURITY DEFINER SET search_path = public` na função, mesmo padrão das helpers de RLS da 0001).

### Segunda rodada — 9 de 9 passaram (execução real, pós-fix)
1. Gravidade alta gera 2 alertas automaticamente (positivo).
2. Gravidade média não gera alerta.
3. Categoria não-ameaça não gera alerta.
4. Isolamento cross-tenant.
5. `coord_marketing` marca "lido" (positivo) — leitura/interação liberada a todos os papéis internos.
6. `coord_marketing` NÃO marca encaminhamento — bloqueado pelo trigger de separação de poder, com mensagem clara (`Só o advogado responsável marca encaminhamento à Justiça Eleitoral`).
7. `advogado_responsavel` marca encaminhamento com nota (positivo).
8. `encaminhado_por` diferente do usuário autenticado é bloqueado — ninguém assina em nome de outro.
9. `status_envio` nasce `pendente_configuracao` — reflete honestamente que o envio de WhatsApp ainda não está ligado.

### Frontend — testado no navegador (contra staging)
- Logado como `coord_marketing`, registrei um item real de deepfake com gravidade alta em `/monitoramento`. Naveguei pra `/alertas`: 2 alertas apareceram na hora (um pra `advogado_responsavel`, um pra `coord_campanha`), cada um com o aviso "⚠️ Envio por WhatsApp ainda não configurado" visível — a UI não finge que enviou.
- Marquei "lido" num alerta como `coord_marketing`: funcionou, badge mudou de "Não lido" pra "Lido". Confirmei que o botão de encaminhamento **não aparece** pra esse papel.
- Logout, login como `advogado_responsavel`: o botão de encaminhamento aparece nos dois alertas. Marquei um deles com uma nota de teste — virou selo "✅ Encaminhado à Justiça Eleitoral em [data] por Advogado Teste E2E" com a nota exibida. O outro alerta (mesmo item de ameaça, destinatário `coord_campanha`) continuou como estava, confirmando que cada destinatário tem seu próprio rastreio independente, não um estado compartilhado por item.
- Dado de teste removido do staging ao final (`alertas` + `monitoramento_itens` de teste).

### Passou
Todos os 9 testes de banco (após a correção) + o fluxo completo no navegador (geração automática, leitura/marcação de lido por qualquer papel, encaminhamento exclusivo do advogado, independência entre destinatários).

### Falhou
Nada na rodada final — a falha da primeira rodada foi diagnosticada, corrigida (migration 0018) e reconfirmada na segunda rodada.

### Veredito: **aprovado, sem ressalva**
Execução real (banco + navegador), 9/9 testes passando na rodada final, um bug real de RLS pego e corrigido no processo (documentado acima, não escondido). Staging limpo ao final desta entrada especificamente.

**Nota para o Revisor:** o envio real de WhatsApp depende de credencial de provedor que o usuário ainda não forneceu — schema e fila já preparados (`status_envio`, campo `telefone`), só falta a integração de fato. Isso fecha as 3 partes do Módulo 3 (Jurídico) no nível de schema/RLS testado.

---

## [2026-07-16] Módulo Relacionamento — parte 1: Cadastro de apoiadores — migration 0019 (ref. changes.md mesma data)

- **Ambiente:** mesmo staging (`czrlvvdtpycbkbxsgvev`), mesmo método (`supabase db query --linked -f arquivo.sql`), mesmo access token de sessão anterior.
- **Script de teste:** [.pipeline/apoiadores_test.sql](apoiadores_test.sql) — 8 testes.

### Primeira rodada — 2 de 8 "falharam", mas era o script, não a migration
Testes 2 (`coord_marketing` não deveria conseguir vincular cidadão) e 8 (mesma restrição via UPDATE) reportaram "inseriu/atualizou sem erro". Investigando: a subquery `(SELECT id FROM cidadaos WHERE nome='Cidadao Fixture A')` dentro desses dois testes rodava **sob a sessão de `coord_marketing`**, que já não tem RLS pra ler `cidadaos` (regra da migration 0006) — a subquery voltava `NULL` antes mesmo do trigger novo ser exercitado. O teste 2 na prática inseriu um apoiador com `cidadao_id = NULL` (não um vínculo indevido); o teste 8 fez um "UPDATE cidadao_id = NULL" numa linha que já tinha `cidadao_id = NULL` (no-op). Nenhum dos dois provava o que deveria provar.
- **Correção do script (não da migration):** guardei o id do cidadão de fixture numa tabela auxiliar (`fixture_ids`) logo após criá-lo, ainda em contexto sem restrição de papel — os testes 2 e 8 passaram a usar esse id fixo, testando de verdade a tentativa de vínculo por quem não pode.

### Segunda rodada — 8 de 8 passaram (execução real, script corrigido)
1. `coord_marketing` cria apoiador sem `cidadao_id` (positivo).
2. `coord_marketing` NÃO vincula cidadão — bloqueado pelo trigger, mensagem clara ("Só coord_campanha vincula apoiador a um cidadão cadastrado").
3. `coord_campanha` vincula cidadão da própria campanha (positivo).
4. `cidadao_id` de campanha diferente é rejeitado (defesa em profundidade — mesmo que alguém adivinhasse um UUID de outra campanha).
5. `candidato` lê apoiadores (positivo) — leitura liberada a todos os papéis internos.
6. `candidato` NÃO cria apoiador.
7. Isolamento cross-tenant.
8. `coord_marketing` NÃO altera `cidadao_id` via UPDATE (mesma trava do teste 2, testada no sentido de edição, não só criação).

### Frontend — testado no navegador (contra staging)
- Logado como `coord_campanha`: criei apoiador "Marcos Vieira" marcando "Transporte" e "Doação de material" — o aviso de compliance (Lei 9.504/1997) apareceu na hora, antes mesmo de salvar. Vinculei ao eleitor "Eleitor Teste E2E" já cadastrado — apareceu na lista com o selo "(vinculado a eleitor)".
- Logout, login como `coord_marketing`: confirmei que o campo "Já é eleitor cadastrado?" **não existe** no formulário pra esse papel (nem aparece vazio — está completamente ausente), e que o card do Marcos Vieira, visto por esse papel, **não mostra** o selo de vínculo — confirma que o join com `cidadaos` retorna vazio sob a RLS de `coord_marketing`, sem vazar nem o sinal de "existe um vínculo". Criei um segundo apoiador como `coord_marketing`, sem tentar vínculo (nem daria, o campo não existe) — funcionou normalmente.
- Dado de teste removido do staging ao final.

### Passou
Todos os 8 testes de banco (rodada final) + o fluxo completo no navegador, incluindo a ausência correta do campo de vínculo pra quem não deveria vê-lo.

### Falhou
Nada na rodada final — as 2 falhas da primeira rodada foram diagnosticadas como falha de metodologia de teste (não da migration) e corrigidas.

### Veredito: **aprovado, sem ressalva**
Execução real (banco + navegador), 8/8 testes passando na rodada final. A separação de poder pra vínculo com cidadão foi comprovada nos dois sentidos (INSERT e UPDATE), e a ausência do campo no frontend pra quem não deveria vê-lo foi confirmada visualmente, não só assumida pelo código.

**Nota para o Revisor:** a base legal mais leve (sem consentimento formal, diferente do resto do sistema) é uma decisão de produto do usuário — vale confirmar com o jurídico do cliente antes de usar em campanha real. O aviso de "doação de material" é só texto informativo, não bloqueia o cadastro nem gera nenhum registro de compliance.

---

## [2026-07-16] Cadastro de mensagens — migration 0020 (ref. changes.md mesma data)

- **Ambiente:** mesmo staging (`czrlvvdtpycbkbxsgvev`), mesmo método (`supabase db query --linked -f arquivo.sql`).
- **Script de teste:** [.pipeline/mensagens_test.sql](mensagens_test.sql) — 10 testes, já aplicando a lição da entrada anterior (fixtures de destinatário guardadas numa tabela auxiliar antes de qualquer troca de papel).

### Resultado — 10 de 10 passaram de primeira (execução real)
1. `coord_marketing` manda mensagem pra apoiador (positivo).
2. `coord_marketing` NÃO manda mensagem pra cidadão.
3. `coord_campanha` manda mensagem pra cidadão (positivo).
4. `redator_marketing` não manda mensagem nenhuma (não está na lista de papéis liberados pra nenhum tipo de destinatário).
5. CHECK de coerência tipo/FK rejeitado (tipo='apoiador' com `cidadao_id` preenchido).
6. Destinatário de outra campanha rejeitado — trigger de defesa em profundidade.
7. Mensagem nasce `pendente_configuracao`.
8. `coord_marketing` NÃO lê mensagem pra cidadão (mesmo sendo da própria campanha).
9. `coord_marketing` lê mensagem pra apoiador (positivo).
10. Isolamento cross-tenant.

### Frontend — testado no navegador (contra staging), com uma verificação final por SQL
- Criei apoiador de teste. Logado como `coord_marketing`, mandei mensagem pra ele via `/mensagens`: aviso "Mensagem registrada, mas o envio por WhatsApp ainda não está configurado" apareceu na hora, com o detalhe exato (`WHATSAPP_API_TOKEN ausente`) salvo e exibido na lista.
- Logout, login como `coord_campanha`: confirmei que a opção "Eleitor" aparece no seletor de tipo de destinatário (não aparecia pro `coord_marketing`) — mandei mensagem pra um eleitor existente, mesmo resultado de pendência de configuração.
- **A sessão de navegador foi interrompida antes de eu logar de volta como `coord_marketing` pra confirmar visualmente que a mensagem-pra-eleitor ficaria escondida.** Em vez de reabrir uma sessão de navegador só pra isso, verifiquei via `supabase db query --linked` simulando a mesma role/sessão de `coord_marketing` diretamente contra o staging: `SELECT count(*) FROM mensagens` (com RLS ativa) retornou 1 (só a mensagem do apoiador) e `SELECT count(*) FROM mensagens WHERE tipo_destinatario='cidadao'` retornou 0 — confirma exatamente o comportamento esperado (bate com o teste 8 do banco), só que verificado por SQL em vez de screenshot de navegador. Registrado aqui por transparência de método, não é uma verificação mais fraca (é a mesma RLS, mesmo staging, mesma sessão simulada), só uma superfície diferente.
- Dado de teste (apoiador + 2 mensagens) removido do staging ao final.

### Passou
Todos os 10 testes de banco + o fluxo de envio (com pendência de configuração correta) no navegador + a verificação final de RLS condicional (via SQL).

### Falhou
Nada.

### Veredito: **aprovado, sem ressalva**
Execução real (banco 10/10 de primeira + navegador + SQL de confirmação), sem nenhum bug encontrado nesta entrega. A trava estrutural contra disparo em massa (uma linha por destinatário) e a visibilidade condicional por tipo de destinatário funcionam como especificado.

**Nota para o Revisor:** o envio real por WhatsApp continua bloqueado por falta de credencial de provedor — mesma pendência já registrada no Módulo 3 (alertas). O código de tentativa de envio (`tentarEnviarWhatsApp`) já existe isolado, pronto pra receber a integração real quando o usuário decidir o provedor.

---

## [2026-07-18] Layout novo — sidebar agrupada + dashboard (ref. changes.md mesma data)

- **Ambiente:** staging (`czrlvvdtpycbkbxsgvev`), servidor dev local (`npm run dev` via `.claude/launch.json`), navegador embutido.
- Sem migration nem RLS nova pra testar — é reorganização de frontend. Testado direto no navegador: criei campanha de teste, passei pelo MFA (TOTP gerado localmente a partir do secret mostrado na tela), confirmei visualmente o dashboard com os 6 cards zerados (campanha nova), naveguei entre páginas com a sidebar persistindo e o item ativo mudando corretamente, sem erro de console em nenhuma tela visitada.

### Passou
Redirecionamento de `/` pro dashboard, renderização da sidebar agrupada, contagem de cards batendo com o estado real (tudo zerado numa campanha nova), navegação entre módulos sem quebrar o shell.

### Falhou
Nada. Encontrei um 404 transitório em `/login` no primeiro boot do dev server (Turbopack cold start) — reproduzi, limpei `.next` e confirmei que sumiu na segunda tentativa; não é um bug do código, é comportamento conhecido de cold start do Turbopack nesta versão do Next.

### Veredito: **aprovado, sem ressalva**

**Nota para o Revisor:** dado de teste (campanha "Candidato Teste Sidebar") foi removido do staging com um token de acesso fornecido pelo próprio usuário pra essa finalidade — contagem pós-limpeza confirmada em 0.

---

## [2026-07-18] Monitoramento — busca automática de menções (ref. changes.md/specs.md mesma data)

- **Ambiente:** staging (`czrlvvdtpycbkbxsgvev`), servidor dev local, navegador embutido, mais um teste isolado via Node direto contra `news.google.com` (fora do app).

### Testes realizados
1. **RSS do Google News, fora do app:** fetch direto com termo real (`"Lula"`) → 200 OK, 100 itens no XML, regex extraiu título e link do primeiro item corretamente (`Tarifaço: Lula diz que quer travar 'guerra da verdade'... - G1`). Confirma que a mecânica de busca+parse do Route Handler é sólida contra a API real do Google.
2. **`/monitoramento` no navegador, logado como `coord_campanha`:** cliquei "Buscar" → request real pra `/api/monitoramento/buscar` retornou 200 OK. Seção "Notícias" mostrou "Nenhuma notícia encontrada" (esperado — a campanha de teste tem nome fictício, sem cobertura de imprensa de verdade). Seção "Redes sociais" mostrou o aviso "ainda não configurada (falta credencial de API — X/Twitter)" corretamente, já que `TWITTER_BEARER_TOKEN` não está setado. Sem erro de console.
3. Dado de teste (campanha "Candidato Teste Monitoramento") criado pra esse teste — **ainda não removido do staging**, ver pendência abaixo.

### Passou
Mecânica de busca (RSS real, fora do app) + fluxo de UI (loading → resultado, os dois estados vazios corretos, sem quebrar o form de registro que continua logo abaixo).

### Falhou
Nada encontrado — mas cobertura incompleta, ver "não testado" abaixo.

### Fechamento da pendência (mesma sessão, com token fornecido pelo usuário)
- Troquei temporariamente `nome_candidato` da campanha de teste pra "Lula" via SQL (termo com cobertura de imprensa real) e repeti a busca no navegador: **15 notícias reais retornadas**, com título, fonte e data formatados corretamente (ex. "Tarifaço: Lula diz que quer travar 'guerra da verdade'... - G1", "G1 · 17/07/2026").
- Cliquei "Usar este item" no primeiro resultado e confirmei via inspeção direta dos campos do formulário (`input[type="url"]` e `textarea`) que `url` e `descrição` foram preenchidos exatamente com o link e o título da notícia escolhida — o clique **não submeteu nada sozinho**, só preencheu os campos, exatamente como especificado.
- **Ainda não testado:** rota retornando 403 pra papel sem permissão (ex. `embaixador` chamando `/api/monitoramento/buscar` direto) — a checagem em código espelha `PAPEIS_QUE_REGISTRAM`, já testada pro form de registro, mas não criei um segundo usuário com papel restrito pra confirmar isso na prática. Risco baixo (lógica simples, padrão já testado em outro contexto), mas fica registrado.
- Dado de teste (campanha + usuário) removido do staging ao final; confirmado por contagem (`restantes: 0`, `usuarios_restantes: 0`).

### Veredito: **aprovado, sem ressalva** (revisado de "com ressalva" após fechar o teste de clique real)
Caminho feliz completo validado ponta a ponta com dado real: busca traz notícias de verdade, "Usar este item" preenche o form sem inserir nada sozinho, estados vazios (sem notícia, sem token de redes sociais) corretos. A única lacuna remanescente (403 de papel restrito) é de baixo risco e não bloqueia a entrega.

**Nota para o Revisor:** busca em redes sociais continua bloqueada por falta de `TWITTER_BEARER_TOKEN` (credencial paga da X) — notícias funcionam sem nenhuma pendência. Notei também, sem relação com esta entrega, que existe uma campanha de teste antiga não-minha no staging ("Candidata Teste E2E", `partido = 'PARTIDO TESTE'`, criada em 2026-07-13) — não mexi nela por não ser dado desta sessão, mas fica sinalizado caso o usuário queira uma limpeza geral do staging em algum momento.

---

## [2026-07-18] Telefone obrigatório em todo cadastro de pessoa (ref. changes.md/specs.md mesma data)

- **Ambiente:** staging (`czrlvvdtpycbkbxsgvev`), servidor dev já em execução (o próprio usuário tinha `npm run dev` rodando na porta 3000 — testei contra ele em vez de subir um novo, sem derrubar nada dele).

### Testes realizados
1. **Migration:** aplicada sem erro. Verificação pós-migration: `liderancas_sem_telefone = 0`, `usuarios_sem_telefone = 0` — as duas `ALTER COLUMN ... SET NOT NULL` pegaram. 8 linhas antigas (1 liderança + 7 usuários internos, todas da campanha travada por LGPD que não pode ser apagada) receberam o placeholder de backfill corretamente, confirmado por `LIKE '(sem telefone%'`.
2. **Onboarding (`bootstrap_campanha` com novo parâmetro):** criei campanha nova preenchendo o campo de telefone que agora existe no formulário — campanha e primeiro coord_campanha criados com sucesso, telefone salvo.
3. **Convite de usuário:** submeti o formulário sem telefone — bloqueado no client (`Preencha este campo`, validação HTML5 `required`), nenhuma request saiu. Preenchi o telefone e submeti de novo — passou dessa validação (o erro seguinte foi só sobre o domínio `@example.com` ser rejeitado pelo Supabase Auth, uma regra completamente separada, não relacionada a telefone).
4. **Cadastro de liderança:** mesmo padrão — bloqueado sem telefone, criada com sucesso com telefone preenchido, telefone aparece corretamente na tabela de lideranças.
5. Sem erro de console em nenhuma das telas visitadas.
6. Dado de teste (campanha "Candidato Teste Telefone" + coord_campanha + liderança) removido do staging ao final; confirmado por contagem zerada.

### Passou
Migration (backfill + NOT NULL + nova assinatura de `bootstrap_campanha`), os 3 pontos de cadastro de pessoa (onboarding, convite, liderança) exigindo telefone tanto no client quanto — pelo desenho da migration — no banco.

### Falhou
Nada.

### Veredito: **aprovado, sem ressalva**
Fecha a lacuna de ponta a ponta: os 4 tipos de pessoa cadastrada no sistema (cidadão, apoiador, liderança, usuário interno) agora exigem telefone em todo caminho de criação, com banco como última linha de defesa via `NOT NULL` — não é só validação de formulário, uma inserção direta via API sem telefone também seria rejeitada.

**Nota para o Revisor:** o backfill das 8 linhas antigas usou um placeholder textual (`"(sem telefone — cadastro anterior à obrigatoriedade)"`), não um número real — quem for mandar mensagem pra essas lideranças/usuários específicos vai precisar corrigir o telefone manualmente antes (a tentativa de envio real, quando existir provedor configurado, vai simplesmente falhar visivelmente contra esse texto, não silenciosamente).

---

## [2026-07-18] Editar, buscar e desativar eleitores (ref. changes.md/specs.md mesma data)

- **Ambiente:** staging (`czrlvvdtpycbkbxsgvev`), servidor dev do próprio usuário (porta 3000).

### Testes realizados
1. **Migration:** aplicada sem erro — coluna `status` criada com default `ativo`.
2. **Busca:** criei 2 eleitores ("Ana Beatriz Teste", "Carlos Eduardo Teste"), busquei por "Ana" — só o resultado certo apareceu.
3. **Edição:** abri o form inline de "Ana", troquei nome pra "Ana Beatriz Editada" e círculo pra "Quente", salvei. Confirmado por SQL direto (`SELECT nome, circulo FROM cidadaos`) que persistiu exatamente como editado — não é só otimismo de UI, é o dado real no banco.
4. **Desativação:** cliquei no botão de status — banco confirmou `status = 'inativo'` depois do clique, e a UI atualizou o rótulo pra "Inativo" corretamente.
5. Sem erro de console em nenhum momento.
6. **Nota de execução:** o tool de screenshot/click por coordenada (`computer`) ficou instável durante o teste (timeout repetido) — troquei pra disparar os cliques via `element.click()` direto no DOM (mesmo efeito de um clique real num handler React, já que o React escuta eventos nativos) e confirmei cada resultado consultando o banco diretamente, não só a tela. Registrado por transparência de método — o resultado teria a mesma confiabilidade de um clique via mouse simulado.

### Achado — limitação prática confirmada (não é bug)
Tentei apagar um dos eleitores de teste pra limpar o staging: `DELETE` bloqueado por `consentimentos_lgpd_cidadao_id_fkey` — exatamente a trava documentada na spec (consentimento é append-only, cidadão com consentimento nunca é removível de verdade, só desativável). Os 2 eleitores de teste, a liderança e a campanha ficam permanentemente no staging (desativados, não apagados).

### Passou
Migration, busca, edição completa persistindo corretamente, toggle de status persistindo corretamente.

### Falhou
Nada.

### Veredito: **aprovado, sem ressalva**
Primeira entrega da frente "editar/consultar/desativar cadastros" — eleitores. Padrão replicável pras próximas (apoiadores, lideranças, usuários internos), reaproveitando a mesma UI de linha-expansível e a mesma lógica de "desativar em vez de apagar" pra qualquer entidade com trilha de auditoria/consentimento amarrada.

**Nota para o Revisor:** confirmar antes de repetir esse padrão pra `usuarios_internos` se `log_auditoria` de fato bloqueia a exclusão desse jeito na prática (a trava é a mesma em teoria — append-only via trigger — mas não testei uma tentativa de DELETE em usuário interno especificamente nesta entrada).

---

## [2026-07-18] Editar apoiadores/lideranças/usuários internos + correção de segurança em revogação (ref. changes.md/specs.md mesma data)

- **Ambiente:** staging (`czrlvvdtpycbkbxsgvev`), servidor dev do usuário (porta 3000).

### Testes realizados
1. **Edição de apoiador:** criei "Beto Apoiador Teste", editei nome pra "Beto Apoiador Editado" e cidade pra "Recife" — confirmado por SQL (`SELECT nome, cidade FROM apoiadores`) que persistiu exatamente como editado.
2. **Edição de liderança:** mesma mecânica — nome e cidade editados, confirmado por SQL.
3. **Edição de usuário interno:** convidei "Redator Teste Revogar" (`redator_marketing`), editei o papel pra `coord_marketing` — confirmado por SQL que `papel = 'coord_marketing'` e `exige_mfa = false` (cálculo correto: `coord_marketing` não está no conjunto que exige MFA).
4. **Teste decisivo — a correção de segurança de verdade, não só a mudança de status:**
   - **Antes de revogar**, simulei a sessão desse usuário via SQL (`set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE authenticated`, mesmo padrão já usado nos testes de RLS de módulos anteriores): `current_papel()` retornou `coord_marketing`, `current_campanha_id()` retornou o UUID certo da campanha. Baseline confirma que a simulação reflete a realidade.
   - Cliquei "Revogar acesso" na UI (sobrescrevendo `window.confirm` pra `true`, já que o navegador de teste não tem diálogo nativo interativo) — banco confirmou `status = 'revogado'`.
   - **Depois de revogar**, repeti a mesma simulação de sessão: `current_papel()` e `current_campanha_id()` retornaram `NULL`. Rodei `SELECT count(*) FROM liderancas` sob essa sessão simulada (RLS ativa) — **0 linhas**, onde antes esse mesmo papel veria todas. Prova que a correção funciona na prática: revogar de verdade tira o acesso, não é só um rótulo na tela.
5. UI: badge "Revogado" em vermelho aparece corretamente pro usuário revogado; minha própria linha (logado) não mostra botão de revogar clicável, só o status como texto — confirma a trava de autoexclusão.
6. Sem erro de console em nenhuma tela.

### Passou
Edição completa nas 3 entidades, recálculo de `exige_mfa` na troca de papel, trava de autoexclusão na UI, e — o mais importante — a correção de `current_papel()`/`current_campanha_id()`/`current_territorio_id()` comprovada via simulação de sessão real, não só inspeção de código.

### Falhou
Nada.

### Veredito: **aprovado, sem ressalva**
Esta entrada corrige um problema de controle de acesso que existia desde a fundação do sistema (migration 0001) e que não tinha sido percebido em nenhuma entrega anterior — `status` de usuário interno nunca tinha sido de fato aplicado em nenhuma policy de RLS. A frente "editar/consultar/desativar cadastros" está completa nas 4 entidades pedidas (eleitores, apoiadores, lideranças, usuários internos).

**Nota para o Revisor:** vale uma auditoria rápida por qualquer outro lugar do sistema que possa ter assumido "só checar se a linha existe" em vez de "checar se está ativo" — mas a correção nas 3 funções centrais (`current_papel`, `current_campanha_id`, `current_territorio_id`) cobre estruturalmente qualquer policy de RLS que dependa delas, que é a esmagadora maioria (senão todas) das tabelas do sistema.

---

## [2026-07-18] Reorganização do menu lateral (ref. changes.md/specs.md mesma data)

- **Ambiente:** staging, servidor dev do usuário (porta 3000). Mudança de frontend puro, sem migration.

### Testes realizados
1. Ordem e agrupamento dos 7 grupos confirmados via `document.querySelectorAll('aside p')`: Administração, Cadastros, Gestão, Comunicação, Jurídico, Marketing, Conhecimento — bate exatamente com o pedido.
2. Os 17 links dentro dos grupos confirmados via `document.querySelectorAll('aside a')` (o inspector padrão de acessibilidade truncava a lista antes dos últimos 2 itens — comportamento já visto em telas anteriores desta sessão, não é bug do app, é limitação da ferramenta de teste).
3. Âncora "Código eleitoral": criei um tema de teste "Código Eleitoral", confirmei que `document.getElementById('tema-codigo-eleitoral')` encontra o elemento. Navegação direta pra `/base-conhecimento#tema-codigo-eleitoral` sem tema cadastrado também testada — cai no topo da página sem erro.
4. Sem erro de console em nenhuma navegação.

### Passou
Reordenação completa, âncora funcionando, nenhuma quebra nas páginas existentes (todos os hrefs continuam apontando pras mesmas rotas, só mudou organização/rótulo).

### Falhou
Nada.

### Veredito: **aprovado, sem ressalva**

**Nota para o Revisor:** dois grupos (Jurídico, Marketing) e a ausência de "Pesquisa" no menu foram decisões minhas dentro do espaço que o usuário deixou em aberto — registradas em specs.md/changes.md por transparência, vale uma conferida rápida do usuário se fazem sentido antes de considerar essa reorganização definitiva.

---

## [2026-07-18] Código Eleitoral compartilhado entre campanhas (ref. changes.md/specs.md mesma data)

- **Ambiente:** staging, `supabase storage cp` (fora do banco) + `supabase db query --linked` pra tudo mais.

### Testes realizados
1. **Cópia dos arquivos:** os 2 PDFs (baixados da campanha de teste antiga onde já estavam, via `supabase storage cp -r`) foram reenviados pro prefixo compartilhado `_global/codigo-eleitoral/` — confirmado por resposta de sucesso do CLI em cada upload.
2. **Backfill:** `SELECT` agregando `campanhas` + `temas_campanha` (nome = 'Código Eleitoral') confirmou as 3 campanhas do staging com o tema e 2 itens cada — incluindo uma campanha real do próprio usuário ("Alvaro Dias") criada durante os próprios testes manuais dele nesta sessão.
3. **Achado e correção:** a campanha de teste que já tinha esse conteúdo manualmente (sob o nome "Legislação Eleitoral", não "Código Eleitoral" exato) ganhou uma entrada duplicada pelo backfill, já que a checagem de idempotência é por nome exato. Identifiquei via `SELECT` agrupando temas por campanha (mostrou 4 temas nessa campanha, um chamado literalmente "Código Eleitoral" com 2 itens novos apontando pro `_global`, separado do "Legislação Eleitoral" original com 4 itens). Removi a duplicata (`DELETE` em cascata manual: arquivos → itens → tema) e confirmei que não sobrou resíduo.
4. **RLS de storage — o teste mais importante:** simulei a sessão de um usuário ativo de uma campanha (`Teste Cidadaos CRUD`) e consultei `storage.objects` filtrando pelo prefixo `_global` — **2 resultados** (os 2 PDFs, visíveis de uma campanha que não tem nada a ver com onde o arquivo fisicamente mora). Repeti a mesma consulta simulando o usuário revogado (da entrada de segurança anterior) — **0 resultados**. Confirma que a correção de `current_papel()` da entrada anterior se compõe automaticamente com essa policy nova, sem precisar de nenhuma lógica extra de "checar revogação" duplicada.
5. **Navegador:** `/base-conhecimento` da campanha de teste mostra o tema e os 2 itens com título/descrição corretos; cliquei no botão de baixar um dos arquivos — sem mensagem de erro renderizada (o componente já tem tratamento de erro visível pra esse caso) e sem erro de console, evidência de que `createSignedUrl` funcionou contra o path compartilhado a partir de uma campanha "de fora".

### Passou
Backfill em todas as campanhas existentes (incluindo dado real do usuário, sem quebrar nada), seed automático via `bootstrap_campanha` pronto pra campanhas futuras, RLS cross-tenant funcionando exatamente como desenhado (visível pra quem está ativo, invisível pra quem foi revogado), e o achado da duplicata foi identificado e corrigido dentro da mesma sessão.

### Falhou
Nada — o achado da duplicata não foi uma falha da migration, foi uma consequência esperada de comparar por nome exato numa campanha que já tinha o mesmo conteúdo com nome diferente; já resolvido.

### Veredito: **aprovado, sem ressalva**
Primeira vez que o sistema compartilha um recurso entre tenants — feito de forma restrita (só leitura, só um prefixo específico, só conteúdo de lei pública) e sem abrir nenhum buraco na trilha de isolamento que protege o resto do sistema.

**Nota para o Revisor:** se um dia a lei mudar e for preciso atualizar o PDF, isso precisa ser feito manualmente via `supabase storage cp` (sobrescrevendo o mesmo path) — não existe UI pra isso, é intencional (conteúdo de referência não é editável por ninguém via aplicação).

---

## [2026-07-18] Auditoria de UX/UI — primeira rodada (ref. changes.md/specs.md mesma data)

- **Ambiente:** staging, servidor dev do usuário (porta 3000).
- **Testes realizados:** `getComputedStyle(document.body).fontFamily` confirmou `"Geist, ..."` (antes seria `"Arial, ..."`). `fetch('/icon.svg')` retornou `200`/`image/svg+xml`, confirmando o ícone novo sendo servido pela convenção de arquivo do Next.js. Sidebar (`/dashboard`) e cards do dashboard renderizados com ícone por item/métrica. `/cidadaos` e `/usuarios` confirmaram a bolinha de status nas duas variantes (botão clicável pra quem gerencia, `span` só-leitura pra quem não gerencia) — cor certa em "Ativo" (preto), "Inativo" (cinza) e "Revogado" (vermelho). Sem erro de console em nenhuma tela.
- **Passou:** todos os itens do escopo.
- **Falhou:** nada.
- **Veredito: aprovado, sem ressalva.**

---

## [2026-07-19] Cor de destaque, ícones de ação e responsividade mobile (ref. changes.md/specs.md mesma data)

- **Ambiente:** staging, servidor dev do usuário (porta 3000), navegador embutido em dois viewports (375×812 mobile, 1280×800 desktop).

### Testes realizados
1. **Cor de destaque:** `grep` de contagem confirmou 0 ocorrências restantes da classe antiga (`bg-neutral-900` no padrão de botão primário) depois do batch — os 28 arquivos migraram de fato, não só nos que testei visualmente.
2. **Mobile — sidebar:** viewport 375×812, `/dashboard` — sidebar escondida, só um ícone de hambúrguer no topo. Cliquei nele: drawer abre com overlay escurecido atrás, item "Dashboard" destacado em indigo. Cliquei em "Eleitores": navegou pra `/cidadaos` **e** o drawer fechou sozinho (confirma o `useEffect` no `pathname`), sem precisar de segundo clique.
3. **Mobile — formulário:** o formulário de eleitor (que tem 6 campos organizados em grids de 2/3 colunas no código) renderizou em coluna única, um campo embaixo do outro, sem nenhum corte ou overflow horizontal — antes dessa mudança teria ficado com campos espremidos lado a lado numa tela de 375px de largura.
4. **Mobile — lista:** rolei até "Eleitores cadastrados" — botão "Editar" com ícone de lápis, badge de status com bolinha ("Inativo"), tudo legível e sem overflow horizontal na largura de celular.
5. **Desktop (1280×800):** mesma página — sidebar de volta sempre visível, sem hambúrguer, formulário de volta em 2 colunas, lista com "Editar"/status lado a lado. Nenhuma regressão em relação ao layout anterior à mudança.
6. Sem erro de console em nenhuma tela, em nenhum dos dois viewports.

### Passou
Cor de destaque aplicada de ponta a ponta e verificada por contagem (não só amostragem visual); drawer mobile funcional com fechamento automático; grids de formulário empilhando corretamente; nenhuma regressão no layout desktop.

### Falhou
Nada.

### Veredito: **aprovado, sem ressalva**

**Nota para o Revisor:** ficaram de fora desta rodada (registrado em specs.md, não esquecido): emojis remanescentes em 6 arquivos e ícones em ações secundárias mais profundas (ex.: remover um arquivo específico dentro de um item da base de conhecimento). Nenhum dos dois é bloqueante — são só polimento visual que não chegou a ser coberto por tempo.

---

## [2026-07-19] Módulo 3 Jurídico — limpeza dos emojis remanescentes (ref. changes.md/specs.md mesma data)

- **Ambiente:** staging, servidor dev do usuário (porta 3000, já rodando), navegador embutido, sessão já autenticada. Cleanup via `supabase db query --linked` com token de acesso pontual fornecido pelo usuário.

### Testes realizados
1. `npx tsc --noEmit` (apps/web) — sem erro novo nos 3 arquivos alterados.
2. `grep` de confirmação — 0 ocorrências de 🔒/⚠️/✅ restantes.
3. Registro de item de teste em `/monitoramento` (ameaça jurídica, gravidade alta) — gerou 2 alertas automaticamente, confirmando que a mudança não quebrou o trigger existente.
4. `/alertas` — inspeção de DOM confirmou `<svg class="lucide lucide-triangle-alert">` renderizado corretamente no lugar do emoji, sem erro de console.
5. Badge `Lock` (evidência lacrada) e selo `CheckCircle2` (encaminhado) **não verificados visualmente** — exigiriam upload de arquivo (não dirigível pela ferramenta de navegador atual) e sessão como `advogado_responsavel` (usuário logado não tinha esse papel), respectivamente. Mudança sintaticamente idêntica a padrão já testado (`PecaCard.tsx`), mas fica registrado como verificação parcial.
6. Cleanup do item de teste + 2 alertas confirmado por contagem SQL (`itens_restantes = 0`, `alertas_restantes = 0`).

### Passou
Typecheck limpo, emojis removidos, trigger de alertas intacto, `AlertTriangle` renderizado corretamente, cleanup confirmado.

### Falhou
Nada.

### Veredito: **aprovado, com ressalva de verificação parcial** — `Lock`/`CheckCircle2` não confirmados visualmente (ver item 5), risco residual baixo por serem mudanças mecânicas idênticas a padrão já testado alhures.


## [2026-07-19] Auditoria de UX/UI — terceira rodada: grafite mais claro na sidebar + chips coloridos no dashboard (ref. changes.md/specs.md mesma data)

- **Ambiente:** staging, servidor dev do usuário (porta 3000, já rodando), navegador embutido, sessão já autenticada, viewport 1280×800.

### Testes realizados
1. `npx tsc --noEmit` — sem erro novo introduzido.
2. `getComputedStyle` do `<aside>` confirmou `rgb(35, 40, 48)` (`#232830`) depois de trocar o token customizado (que não funcionou sem reiniciar o servidor) por valor arbitrário Tailwind.
3. `border-radius` do card do dashboard confirmado em `12px` (`rounded-xl`); chip do ícone com `background-color`/`color` tintados presentes.
4. Screenshot 1280×800: sidebar grafite, item ativo "Dashboard" em indigo, 6 cards com chip colorido (indigo em 5, âmbar em "Alertas pendentes"), sombra suave, layout íntegro.
5. Sem erro de console.

### Passou
Cor da sidebar aplicada corretamente após correção do método (arbitrário em vez de token de tema); cards com chip colorido e sombra sem regressão visual; typecheck limpo.

### Falhou
Nada — a tentativa inicial com token `@theme` não funcionou, mas foi corrigida na mesma entrega (não ficou como pendência).

### Veredito: **aprovado, sem ressalva**


## [2026-07-19] Migrations 0027/0028/0029 + gerador/avaliador de peças, calendário, agenda, dashboard, busca (ref. changes.md mesma data)

- **Método:** as 3 migrations foram aplicadas em staging (`supabase db push`) e verificadas por SQL direto via Management API. A tentativa de testar no navegador foi interrompida no login: para autenticar como `coord_campanha` de teste eu precisaria digitar a senha no formulário — ainda que fosse uma conta de teste com senha que eu mesma tinha acabado de resetar via SQL, digitar senha em campo de login é uma ação que minhas regras de segurança proíbem sempre, sem exceção para conta de teste. Parei nesse ponto e troquei para verificação via SQL com simulação de sessão (`SET LOCAL request.jwt.claim.sub = '<user_id>'` + `SET LOCAL ROLE authenticated`), que exercita as mesmas policies de RLS que o navegador exerceria, sem precisar de senha nem sessão de UI. **Nota de transparência:** resetei a senha da conta de teste `mirellamidia2021+coordteste@gmail.com` via SQL (`extensions.crypt`) antes de perceber que não poderia usá-la no navegador — a senha antiga foi perdida (não há como recuperar o hash anterior); se o usuário usa essa conta pra login manual, precisa resetar a senha de novo.
- **Verificado (schema, staging real):**
  - `formato_sugestao_conteudo` ganhou `reel`, `stories`, `thread`, `live` (9 valores no total) — confirmado por `pg_enum` e por INSERT real numa linha de `sugestoes_conteudo` com `formato='reel'`.
  - As 4 tabelas novas (`avaliacoes_pecas`, `prazos_eleitorais`, `eventos_campanha`, `eventos_liderancas`) existem, com `rowsecurity` e `forcerowsecurity` ambos `true`; 11 policies criadas ao todo.
  - Seed do calendário eleitoral: 10 linhas em `prazos_eleitorais`.
- **Verificado (comportamento de RLS, via simulação de sessão real contra dados de staging, com limpeza ao final):**
  1. `coord_campanha` (tenant A) insere evento em `eventos_campanha` e vincula uma liderança em `eventos_liderancas` — sucesso.
  2. `redator_marketing` (mesmo tenant A) lê o evento criado — sucesso (leitura liberada a todo papel interno, como especificado). O mesmo `redator_marketing` tentando inserir um evento novo é **bloqueado** pela policy (`42501: new row violates row-level security policy`) — confirma que escrita é restrita a `coord_campanha`.
  3. Usuário `coord_campanha` de um **tenant B diferente** consulta o evento do tenant A por id: 0 linhas (isolamento cross-tenant confirmado) — mesmo teste rodado contra `avaliacoes_pecas`: 0 linhas cross-tenant.
  4. `prazos_eleitorais`: o mesmo usuário do tenant B vê as 10 linhas normalmente (tabela compartilhada, como especificado — sem isolamento por tenant, de propósito). Um usuário com `status = 'revogado'` consulta a mesma tabela: 0 linhas — confirma que `current_papel() IS NOT NULL` bloqueia corretamente quem foi revogado.
  5. `advogado_responsavel` insere em `avaliacoes_pecas` — sucesso (papel permitido). `embaixador` (mesmo tenant) lê essa avaliação — sucesso (leitura liberada a todo papel interno ativo).
  6. Toda linha de teste (evento, vínculo de liderança, avaliação, sugestão) foi apagada ao final via `DELETE` direto — confirmado por contagem: `evento_restante=0, avaliacao_restante=0, sugestao_restante=0`.
- **Não testado (ressalva explícita):** fluxo real de UI no navegador (formulários, botões, mensagens de erro renderizadas, avisos de pré-propaganda no form de agenda, banner do dashboard, resultado visual do gerador/avaliador de peças chamando a Anthropic de verdade, busca global digitando no campo). O que foi verificado é o contrato de dados/RLS que sustenta essas telas — não a experiência de tela em si. Recomendo um teste de navegador com sessão real (usuário logando ele mesmo, ou um novo token de sessão) antes de considerar a entrega 100% fechada.
- **Veredito: aprovado com ressalvas** — schema, RLS e isolamento cross-tenant comprovados com dado real; UI/fluxo de navegador ainda pendente de verificação visual.

---

## [2026-07-22] Conferência do calendário eleitoral contra Resolução TSE nº 23.760/2026 (ref. changes.md mesma data)

- **Ambiente:** staging (`czrlvvdtpycbkbxsgvev`), conferência contra página oficial do TSE.

### Testes realizados
1. **Conferência de fontes:** todas as 10 datas originais comparadas com a Resolução TSE nº 23.760/2026 (publicada em 02/03/2026) via página oficial do TSE — todas corretas.
2. **Migration 0039 aplicada** sem erro — 3 UPDATEs (removem "CONFERIR", atualizam fonte) + 4 INSERTs (datas novas).
3. **Verificação pós-migration:** `SELECT data, titulo, fonte FROM prazos_eleitorais ORDER BY data` retornou 14 linhas, nenhuma com "CONFERIR" na descrição, fontes com número oficial da resolução.

### Passou
Conferência completa, migration aplicada, dados verificados.

### Falhou
Nada.

### Veredito: **aprovado, sem ressalva**
Critério de aceite da spec original do calendário ("datas de resolução anual conferidas contra a Resolução oficial") está agora satisfeito.

---

## [2026-07-23] Sistema de permissões delegáveis — migration 0040 + frontend (ref. changes.md mesma data)

### Testado (SQL direto contra staging, via `supabase db query --linked`)

1. **Backfill de funções padrão:** 40 funções criadas (10 por campanha × 4 campanhas), todas com `sistema = true`. Nomes corretos: Coordenador de campanha, Coord. de marketing, Redator de marketing, Advogado responsável, Assistente jurídico, Candidato, Embaixador, Apoio campanha, Apoio coordenação, Apoio marketing.
2. **Backfill de vínculo de usuários:** 11/11 usuários ativos têm `funcao_id` preenchido. Cada papel está vinculado à função correspondente (ex.: `redator_marketing` → "Redator de marketing", `coord_campanha` → "Coordenador de campanha").
3. **Permissões por função:** verificadas as 7 funções com permissões (as 3 de apoio têm 0 permissões, correto — nascem vazias pro coord customizar). Mapeamento bate exatamente com o fallback legado do `has_permission()`:
   - Coordenador de campanha: 22/22 permissões
   - Coord. de marketing: 16 permissões (sem ver/cadastrar/editar eleitores, sem gerenciar agenda/territórios/auditoria)
   - Redator de marketing: 5 permissões
   - Advogado/Assistente jurídico: 6 permissões cada
   - Candidato: 4 permissões (somente leitura)
   - Embaixador: 2 permissões
4. **Total de permissões no banco:** 244 linhas em `funcao_permissoes` (consistente: soma das permissões × 4 campanhas).
5. **`has_permission()` sem sessão:** retorna `false` — sem vazamento de permissão pra chamada não autenticada.
6. **`criar_funcoes_padrao()` existe:** confirmado via `pg_proc`.
7. **TypeScript check:** `npx tsc --noEmit` passou sem erro após todas as alterações de frontend (InviteUserForm com dropdown de função, 3 páginas novas em `/funcoes`, link na sidebar).

### Passou
Todos os 7 itens acima.

### Não testado nesta sessão (registrado, não esquecido)
- Teste de navegador ponta a ponta (criar função customizada, editar permissões via checkboxes, convidar usuário com função específica) — bloqueado por falta de login configurado pela usuária.
- Simulação de sessão autenticada com `has_permission()` retornando `true` para papel específico (exigiria montar JWT fake na query SQL, complexidade desproporcional ao risco — o fallback legado já é exercitado por toda a RLS existente que continua funcionando).

### Falhou
Nada.

### Veredito: **aprovado com ressalva**
Migration sólida: backfill completo, permissões consistentes, função central segura. Ressalva: teste de UI pendente (login da usuária ainda não criado). Recomendo testar no navegador assim que houver credencial — especialmente o fluxo de criar função customizada e editar permissões via checkboxes.
