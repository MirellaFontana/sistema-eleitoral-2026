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
