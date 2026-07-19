# specs.md — Planejador

Aqui o **Planejador** registra a especificação de cada tarefa antes de qualquer linha de código ser escrita: objetivo, critérios de aceite, entidades/tabelas afetadas, riscos jurídicos (TSE/LGPD) envolvidos.

Formato sugerido por entrada:

```
## [data] Nome da tarefa
- Objetivo:
- Critérios de aceite:
- Dados/tabelas afetadas:
- Risco TSE/LGPD:
- Dependências:
```

---

## [2026-07-12] Módulo 1 — Schema base multitenant (campanhas, usuários, cidadãos, consentimento)

- **Objetivo:** desenhar o schema fundacional do Supabase/Postgres que serve de raiz de isolamento multitenant para todo o sistema, cobrindo cadastro de campanha, usuários internos, CRM do cidadão (com segmentação por Círculo e Território) e registro de consentimento LGPD. Nenhum outro módulo é desenvolvido antes deste estar sólido (CLAUDE.md, regra de ouro nº2).

- **Nota de divergência a confirmar com o usuário:** a mensagem original sugeriu papéis Admin/Coordenador/Voluntário para `usuarios_internos`. `docs/especificacao-v1.md` §3.2 já define papéis fixos e diferentes: **Embaixador, Advogado, Coord. de comunicação, Coord. de campanha, Candidato** — com regras de acesso específicas por papel (ex.: Embaixador só vê o próprio território; Advogado não acessa base nominal de cidadão; Coord. de campanha exige MFA obrigatório). Esta spec segue os papéis da especificação (fonte de verdade), não os sugeridos na mensagem. Confirmar antes do Programador gerar a migration.

### Tabelas

**`campanhas`** (anchor tenant — raiz de todo o isolamento)
- `id` uuid pk
- `nome_candidato` text
- `cargo` text (deputado estadual / deputado federal / senador / governador)
- `uf` char(2)
- `partido` text
- `plano_contratado` text
- `status` text (ativa / suspensa / encerrada)
- `criado_em` timestamptz default now()

**`usuarios_internos`**
- `id` uuid pk
- `campanha_id` uuid fk → campanhas.id, not null
- `auth_user_id` uuid fk → auth.users.id (Supabase Auth), not null
- `papel` text check in ('embaixador', 'advogado', 'coord_comunicacao', 'coord_campanha', 'candidato')
- `territorio_id` uuid fk → territorios.id, nullable (obrigatório quando papel = 'embaixador')
- `mfa_habilitado` boolean default false (obrigatório = true para coord_campanha e candidato — validar em código, não só no banco)
- `status` text (ativo / revogado / expirado)
- `expira_em` timestamptz nullable (obrigatório para embaixador — expiração automática de fim de ciclo, especificação §3.2)
- `criado_em` timestamptz default now()

**`territorios`** (suporte à segmentação territorial e ao escopo do embaixador)
- `id` uuid pk
- `campanha_id` uuid fk → campanhas.id, not null
- `nome` text
- `geom` geometry(Polygon, 4326) — PostGIS, área de atuação/bairro

**`cidadaos`** (CRM do Cidadão)
- `id` uuid pk
- `campanha_id` uuid fk → campanhas.id, not null
- `nome` text
- `contato` jsonb (telefone, whatsapp, email — canais múltiplos)
- `circulo` text check in ('quente', 'morno', 'frio') — temperatura do voto
- `estagio_funil` text check in ('atracao', 'interacao', 'ativacao', 'advocacia') — funil de engajamento
- `municipio` text
- `bairro` text
- `secao_eleitoral` text nullable
- `geom` geometry(Point, 4326) — PostGIS, lat/long
- `temas_interesse` text[] nullable
- `atendido_por_ia` boolean default false — rótulo obrigatório de automação (Resolução TSE 23.732/2024)
- `origem_cadastro` text check in ('enquete', 'demanda', 'app', 'embaixador') — nunca 'importacao' ou 'digitacao_campanha' (regra inegociável, CLAUDE.md)
- `embaixador_coletor_id` uuid fk → usuarios_internos.id, nullable — obrigatório quando origem_cadastro = 'embaixador'
- `criado_em` timestamptz default now()

**`consentimentos_lgpd`**
- `id` uuid pk
- `cidadao_id` uuid fk → cidadaos.id, not null
- `campanha_id` uuid fk → campanhas.id, not null (denormalizado para RLS direta, evita join em toda policy)
- `finalidade` text
- `base_legal` text
- `texto_aceito` text — snapshot do texto exibido no momento do aceite
- `canal_origem` text check in ('whatsapp', 'formulario_web', 'app', 'porta_a_porta')
- `ip_origem` inet nullable
- `geom_coleta` geometry(Point, 4326) nullable — obrigatório quando canal_origem = 'porta_a_porta' (aceite capturado no aparelho, no momento, com o cidadão presente)
- `status` text check in ('ativo', 'revogado')
- `criado_em` timestamptz default now()
- **Regra:** tabela append-only para o registro em si; revogação = novo registro com status='revogado', nunca UPDATE/DELETE do original (especificação §3.1).

**`log_auditoria`** (já prevista na especificação, incluída aqui por ser dependência direta de toda tabela sensível acima)
- `id` uuid pk
- `campanha_id` uuid fk → campanhas.id, not null
- `ator_id` uuid fk → usuarios_internos.id
- `acao` text (select_export / insert / update / revogacao)
- `entidade` text, `entidade_id` uuid
- `antes` jsonb nullable, `depois` jsonb nullable
- `timestamp` timestamptz default now()
- Sem política de UPDATE/DELETE — apenas INSERT e SELECT.

### Lógica das políticas RLS

Princípio geral: toda tabela com `campanha_id` tem RLS **habilitada e forçada** (`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`, para valer até para o dono da tabela). Nenhuma policy usa `USING (true)`.

1. **Função auxiliar** `auth.campanha_id()` — resolve a campanha do usuário autenticado a partir de `usuarios_internos.auth_user_id = auth.uid()`. Toda policy filtra por `campanha_id = auth.campanha_id()`. Isso é o que impede cruzamento entre campanhas.
2. **`cidadaos` / `consentimentos_lgpd`:**
   - Embaixador: SELECT/INSERT restrito a `embaixador_coletor_id = auth.usuario_interno_id()` OU `territorio` do próprio embaixador — nunca a base completa.
   - Advogado: sem policy de SELECT nesta tabela (especificação §3.2: advogado não acessa base nominal). Só enxerga o que precisar via view agregada, se necessário.
   - Coord. de comunicação: sem SELECT de dado pessoal de cidadão.
   - Coord. de campanha: SELECT amplo dentro da própria campanha.
   - Candidato: sem SELECT de dado pessoal bruto — apenas views agregadas (painel executivo).
3. **`usuarios_internos`:** SELECT restrito a `campanha_id = auth.campanha_id()`; UPDATE de `papel`/`status` restrito a coord_campanha.
4. **Exportação (export de `cidadaos`/`consentimentos_lgpd`):** não é uma policy de RLS simples — é uma função/endpoint separado com permissão própria (`pode_exportar` em `usuarios_internos`), e toda chamada gera linha obrigatória em `log_auditoria` antes de liberar os dados (especificação §3.2, requisito nº2).
5. **`log_auditoria`:** INSERT liberado a qualquer usuário autenticado da própria campanha (via trigger de aplicação, não escrita direta); SELECT restrito a coord_campanha e advogado (trilha de auditoria faz parte do bloco jurídico).
6. Toda policy usa `campanha_id` diretamente na cláusula (evitar subquery custosa em tabelas grandes) — por isso `consentimentos_lgpd.campanha_id` é denormalizado mesmo tendo `cidadao_id`.

### Critérios de aceite
- [ ] Migration cria as 6 tabelas acima com FKs, checks e defaults descritos.
- [ ] RLS habilitada e **forçada** em todas as tabelas com `campanha_id`.
- [ ] Nenhuma policy permite SELECT/INSERT/UPDATE cross-campanha sob nenhuma condição — testável com 2 campanhas fake e 2 usuários fake.
- [ ] Embaixador não consegue ler cidadão fora do próprio território/coleta.
- [ ] Advogado e candidato não conseguem SELECT de PII em `cidadaos`.
- [ ] `origem_cadastro` de `cidadaos` nunca aceita valor equivalente a importação/digitação em massa (constraint de check, não só validação de app).
- [ ] `atendido_por_ia` existe e é consultável para compor o rótulo de conteúdo sintético (regra de ouro nº1).
- [ ] `consentimentos_lgpd` não permite UPDATE/DELETE via policy (só INSERT/SELECT).
- [ ] `log_auditoria` não permite UPDATE/DELETE via policy.

### Risco TSE/LGPD
- Alto se RLS falhar: dado de cidadão de uma campanha vazando para outra é ao mesmo tempo violação de LGPD e evento que mata a venda para o mercado (CLAUDE.md).
- `atendido_por_ia` é o campo que sustenta a rotulagem obrigatória de conteúdo sintético (Resolução TSE 23.732/2024) — sem ele, não há como provar/aplicar o rótulo depois.
- `origem_cadastro` com constraint de banco (não só de app) é a garantia técnica da regra "cidadão nunca entra por digitação/importação".

### Dependências
- Supabase Auth configurado (tabela `auth.users`) antes de `usuarios_internos`.
- Extensão PostGIS habilitada no projeto Supabase antes de qualquer `geometry(...)`.
- Confirmação do usuário sobre a nota de divergência de papéis acima antes de o Programador gerar a migration SQL.

---

## [2026-07-13] Escopo do produto reduzido a 3 módulos (decisão do usuário)

- **Simulador de quociente eleitoral removido do escopo.** Motivo do usuário: já é oferecido pelos partidos — deixa de fazer sentido como diferencial ou isca comercial própria.
- **Módulos confirmados, nesta ordem:**
  1. **Tabelas e cadastros** — Módulo 1 (esta especificação). Schema/RLS já prontos e testados; telas de cadastro ainda não existem (ver spec abaixo).
  2. **Jurídico** — bloco de proteção jurídica da Camada 3 (conformidade/rotulagem IA, escudo antideepfake, matriz de alertas).
  3. **Relacionamento com eleitores** — bloco de relacionamento da Camada 3 (enquete, loop de demanda, embaixadores, mandato).
- Camada 4 (painéis) e módulos de apoio (agenda territorial) não têm dono de módulo próprio — nascem dentro do módulo 2 ou 3 conforme a tela precisar.

---

## [2026-07-13] Telas de cadastro — Nível 1 (campanha) e Nível 2 (usuários internos)

- **Objetivo:** construir a interface web que dá uso real ao schema do Módulo 1 — hoje só é possível inserir dado via SQL direto. Cobre os dois primeiros níveis de cadastro da especificação (§3.1): setup da campanha (raiz do tenant) e setup da estrutura interna (usuários e papéis). **Não cobre ainda** o Nível 3 (cadastro de cidadão pelo embaixador em campo) — isso é a próxima spec, depende de já existir usuário interno de verdade para testar.
- **Por que começar aqui, não pelo embaixador:** o fluxo do embaixador (Nível 3) só faz sentido testar com um `usuarios_internos` real logado — sem login/onboarding funcionando, não dá pra validar o app de campo de ponta a ponta.

### Escopo desta tela
1. **Login** — Supabase Auth (email/senha). MFA obrigatório (coord_campanha/candidato) fica para uma iteração seguinte; não bloqueia esta entrega.
2. **Onboarding de campanha (Nível 1)** — formulário único: nome do candidato, cargo, UF, partido, plano contratado. Cria a linha raiz em `campanhas`. Só acontece uma vez, na primeira entrada.
3. **Gestão de usuários internos (Nível 2)** — lista os usuários da campanha (nome, papel, status, expiração) + formulário de convite/cadastro (nome, papel, território quando embaixador, MFA obrigatório quando coord_campanha/candidato). Edição de papel/status restrita a `coord_campanha`, espelhando a policy já testada — a tela não reimplementa a regra, só reflete o que a policy permite (se a query falhar por RLS, a tela mostra o erro, não contorna).

### Stack
- Next.js (App Router) + TypeScript, dentro de `apps/web/` no mesmo repositório.
- `@supabase/supabase-js` + `@supabase/ssr` para sessão de auth no servidor.
- Tailwind para estilo — sem framework de UI pesado nesta fase.

### Critérios de aceite
- [ ] Login funcional contra o projeto Supabase de staging já linkado.
- [ ] Onboarding cria `campanhas` uma única vez por conta (não deixa duplicar).
- [ ] Tela de usuários internos lista respeitando RLS (cada sessão só vê a própria campanha — já garantido pelo banco, a tela só precisa não quebrar).
- [ ] Cadastro de usuário interno com papel `embaixador` exige território e data de expiração antes de enviar (mesma regra que já existe como CHECK no banco — validação de UI é conveniência, não substitui o CHECK).
- [ ] Nenhuma chamada do frontend usa `service_role` — sempre a chave `anon`/sessão do usuário, para que a RLS testada no Módulo 1 seja o que realmente protege os dados.

### Risco TSE/LGPD
- Baixo nesta entrega — não expõe PII de cidadão, só dado de usuário interno (nome, papel).
- Risco real está em manter a garantia "frontend nunca usa service_role" — se essa regra vazar, todo o trabalho de RLS do Módulo 1 vira decorativo.

### Dependências
- Migrations 0001 + 0002 já aplicadas no staging (confirmado).
- **Bug de bootstrap encontrado ao planejar esta tela (antes de qualquer código):** a migration 0001 nunca teve policy de INSERT em `campanhas`, e `usuarios_internos_insert` exige `current_papel() = 'coord_campanha'` — ou seja, com RLS forçada, **ninguém consegue criar a primeira campanha nem o primeiro usuário interno** pelo caminho normal (galinha-e-ovo). Isso não apareceu nos 13 testes do Módulo 1 porque a fixture era inserida via role com bypassRLS, não pelo caminho real de um usuário novo.
- **Resolução:** função `SECURITY DEFINER` única, `bootstrap_campanha(...)`, que cria a `campanha` e o primeiro `usuarios_internos` (papel `coord_campanha`) atomicamente, só quando `auth.uid()` ainda não pertence a nenhuma campanha. Não abre policy de INSERT permanente em `campanhas` — o controle fica todo dentro da função, uma função, uma responsabilidade. Vai como migration `0003_bootstrap_campanha.sql`, testada antes do frontend ser escrito em cima dela.

---

## [2026-07-13] MFA (TOTP) — pré-requisito descoberto ao testar a tela de convite no navegador

- **Achado:** ao testar de verdade (não só ler o código), o convite de usuário pelo `coord_campanha` falhou com "new row violates row-level security policy" — não é bug de policy, é a policy `usuarios_internos_insert` fazendo exatamente o que foi testada pra fazer no Módulo 1: exige `mfa_verificado()` (sessão em `aal2`). A conta recém-criada não tem MFA configurado, então nunca alcança `aal2`. A spec anterior (telas de cadastro) tinha marcado MFA como "não bloqueia esta entrega" — na prática bloqueia, porque a RLS já exige em produção desde o Módulo 1.
- **Decisão do usuário:** construir o enrollment de MFA agora, como pré-requisito real, em vez de afrouxar a policy.

### Escopo
1. **`/mfa/enroll`** — para usuário com papel `coord_campanha` ou `candidato` sem fator TOTP verificado ainda. Usa `supabase.auth.mfa.enroll({factorType:'totp'})`, mostra QR code, confirma com código de 6 dígitos via `mfa.challengeAndVerify`.
2. **`/mfa/verify`** — para usuário que já tem fator verificado mas a sessão atual ainda está em `aal1` (login novo). Pede o código de 6 dígitos, eleva a sessão pra `aal2` via `mfa.challengeAndVerify`.
3. Redirecionamento centralizado: qualquer página que dependa de ação gated por `mfa_verificado()` (onboarding N2, usuários) checa `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` e manda pro fluxo certo antes de renderizar a ação.

### Critérios de aceite
- [ ] coord_campanha/candidato sem fator → obrigado a passar por `/mfa/enroll` antes de ver a tela de usuários.
- [ ] coord_campanha/candidato com fator, sessão `aal1` → obrigado a passar por `/mfa/verify` a cada novo login.
- [ ] Papéis sem exigência de MFA (embaixador, advogado, coord_comunicacao) não são afetados.
- [ ] Depois do `mfa.challengeAndVerify`, o convite de usuário (que falhou nesta sessão) passa a funcionar.

### Fora do escopo desta entrega (registrado, não esquecido)
- Códigos de recuperação (recovery codes) se o usuário perder o autenticador.
- "Lembrar este dispositivo" — cada login pede o código de novo, por design nesta fase.

---

## [2026-07-13] Base de conhecimento da campanha — pré-requisito antes de qualquer outro nível/módulo

- **Motivo (decisão do usuário):** antes de avançar pro Nível 3 (embaixador) ou pro Módulo 2 (jurídico), precisa existir um lugar pra registrar propostas, biografia e demais informações que os módulos de IA (rascunho de peças, plano de governo) vão usar como fonte de verdade. Sem isso, geração de conteúdo não tem em cima do que se apoiar.
- **Decisões de escopo (confirmadas com o usuário):**
  1. **Estruturado por tema** (não documentos soltos sem organização) — cada item pertence a um tema (ex.: Saúde, Educação, Biografia).
  2. Cada item aceita **descrição digitada OU um arquivo anexado (PDF)**, os dois são opcionais individualmente mas pelo menos um deve existir — cobre tanto "proposta escrita na hora" quanto "sobe o PDF pronto da biografia".
  3. **Sem IA/RAG nesta entrega** — é só repositório de referência que humano consulta. Embedding/busca semântica fica pra quando o módulo jurídico/relacionamento existir de verdade.
  4. **Edição:** `coord_campanha` e `coord_comunicacao`. Leitura: qualquer papel interno da campanha (mesmo padrão de território/usuários).

### Modelo de dados
- **`temas_campanha`** — id, campanha_id, nome, ordem. Isolado por tenant como todo o resto.
- **`base_conhecimento_itens`** — id, campanha_id (denormalizado, evita join), tema_id, titulo, descricao (nullable), arquivo_path (nullable, aponta pro Storage), arquivo_nome_original (nullable), criado_por (usuarios_internos.id), criado_em. CHECK: `descricao IS NOT NULL OR arquivo_path IS NOT NULL`.
- **Storage:** bucket privado `base-conhecimento`, caminho `{campanha_id}/{tema_id}/{arquivo}` — RLS de storage.objects usa o mesmo `current_campanha_id()`/`current_papel()` já testados no Módulo 1, filtrando pelo primeiro segmento do path.

### Critérios de aceite
- [ ] RLS force-enabled nas duas tabelas novas, mesmo padrão de isolamento por `campanha_id` do Módulo 1.
- [ ] CHECK que impede item sem descrição E sem arquivo.
- [ ] Upload/download de arquivo só funciona dentro da própria campanha (storage RLS testada, não só a tabela).
- [ ] `coord_comunicacao` consegue criar/editar item (diferente das outras telas, onde esse papel só lê).
- [ ] Embaixador/advogado/candidato conseguem **ler** a base (consulta), não editar.

### Dependências
- Extensão de Storage do Supabase habilitada no projeto (já vem por padrão).
- Reaproveita `current_campanha_id()`/`current_papel()` da migration 0001 — não recria lógica de tenant.

---

## [2026-07-13] Reorganização de módulos + hierarquia de papéis (decisão do usuário)

- **Módulos renumerados:** Módulo 1 continua sendo tabelas/cadastros (schema + telas já prontas). **Módulo 2 = Campanha** — é exatamente a base de conhecimento já construída (propostas/temas/projetos que nutrem a campanha), só a categorização certa, sem código novo. **Módulo 3 = Jurídico**, **Módulo 4 = Marketing** (antes "relacionamento com eleitores" — nome e talvez escopo revistos quando chegar a vez).
- **Hierarquia de acesso (decisão do usuário):** `candidato` e `coord_campanha` são o nível mais alto, com leitura de tudo (inclusive PII de cidadão). Abaixo deles, dois ramos com níveis internos: Jurídico e Marketing. `candidato` **não** ganha poder administrativo (gestão de usuários/edição de campanha continua exclusiva de `coord_campanha`) — só leitura ampliada.
- **Mudança de segurança relevante:** isso reverte a regra original da especificação (§3.2) de que candidato não acessa PII bruta de cidadão. Decisão explícita e confirmada do usuário, documentada aqui porque contradiz o texto de origem — próxima leitura da especificação deve considerar esta entrada como a atualização vigente.

### Estrutura de papéis proposta (sugerida por mim, confirmada com o usuário)
- **Jurídico:** `advogado_responsavel` (acesso total ao bloco jurídico + único que pode fazer encaminhamento formal à Justiça Eleitoral) e `assistente_juridico` (mesmo acesso de consulta/preparação, sem o poder de encaminhamento).
- **Marketing:** `coord_marketing` (sucede `coord_comunicacao` — acesso total ao bloco de marketing + edita base de conhecimento) e `redator_marketing` (cria/edita rascunho de peça, não edita base de conhecimento nem aprova publicação).
- **Sem mudança:** `coord_campanha`, `candidato` (agora com leitura total), `embaixador` (papel de campo, fora dessa hierarquia corporativa).

### Migração técnica (enum não permite remover valor, só renomear/adicionar)
1. `ALTER TYPE papel_usuario RENAME VALUE 'coord_comunicacao' TO 'coord_marketing'`.
2. `ALTER TYPE papel_usuario RENAME VALUE 'advogado' TO 'advogado_responsavel'`.
3. `ALTER TYPE papel_usuario ADD VALUE 'assistente_juridico'` e `ADD VALUE 'redator_marketing'`.
4. Em migration separada (enum novo valor não pode ser usado na mesma transação que o cria, em versões mais antigas do Postgres — separar por segurança): atualizar todas as policies que referenciam papéis antigos (`cidadaos_select`, `consentimentos_select`, `log_auditoria_select`, `base_conhecimento_itens_*`, `temas_campanha_*`) para os novos nomes, e remover `candidato` da exclusão de PII em `cidadaos`/`consentimentos_lgpd`.

### Critérios de aceite
- [ ] Enum renomeado sem quebrar dados existentes (usuários já cadastrados com `advogado`/`coord_comunicacao` continuam válidos sob o novo nome).
- [ ] `candidato` lê `cidadaos`/`consentimentos_lgpd`/`log_auditoria` como `coord_campanha` lê hoje — testado com fixture real.
- [ ] `candidato` continua sem conseguir INSERT/UPDATE em `usuarios_internos`/`campanhas` (sem poder administrativo).
- [ ] `advogado_responsavel` e `assistente_juridico` têm o mesmo acesso de leitura ao bloco jurídico; só `advogado_responsavel` tem a flag/permissão de encaminhamento formal (a decisão de ONDE isso vira campo de banco fica para quando o módulo Jurídico for construído — aqui só garantimos que o papel existe e é distinguível).
- [ ] `coord_marketing` e `redator_marketing`: ambos leem o bloco de marketing; só `coord_marketing` edita `base_conhecimento_itens`/`temas_campanha` (retestar a policy já existente com o nome novo).

---

## [2026-07-13] Monitoramento (clipping) — mais uma peça do Módulo 2 Campanha

- **Motivo (decisão do usuário):** um único registro de "coisa encontrada sobre o candidato na internet" — não separado entre jurídico e marketing desde a entrada, porque a mesma menção pode interessar aos dois times (ameaça jurídica vs. oportunidade de marketing). Vive no Módulo Campanha porque é dali que "dispara" pros dois.
- **"Código eleitoral":** resolvido sem tabela nova — é só mais um tema dentro da base de conhecimento já existente (ex.: tema "Legislação" com PDF da Lei 9.504/1997, Resolução TSE etc.).
- **Escopo confirmado:** registro **manual** nesta entrega (alguém da equipe cola link/print + nota). Sem crawler/Google Alerts agora — fica registrado como evolução futura, não escondido.

### Modelo de dados
- **`monitoramento_itens`** — campanha_id, url (nullable — nem toda menção tem link público), descricao (obrigatória — é sempre "o que a pessoa viu"), categoria (`ameaca_juridica`, `deepfake_suspeito`, `mencao_neutra`, `oportunidade_marketing`, `outro`), gravidade (nullable — só relevante pras categorias de ameaça), status (`novo`, `em_analise`, `resolvido`), captura_path (nullable, Storage), registrado_por, created_at.
- **Storage:** bucket privado `monitoramento`, mesmo padrão de path/RLS do `base-conhecimento` (`{campanha_id}/{arquivo}`).

### Acesso
- Leitura: qualquer papel interno da campanha (mesmo padrão dos temas/itens de conhecimento).
- Criação: `coord_campanha`, `advogado_responsavel`, `assistente_juridico`, `coord_marketing`, `redator_marketing`. Não inclui `embaixador` (papel de campo, não é função dele) nem `candidato` (mantém "só leitura, sem poder administrativo" já decidido — registrar item é tratado como ação de conteúdo, não leitura).
- **Fora do escopo desta entrega, registrado:** workflow de "encaminhamento formal à Justiça Eleitoral" a partir de um item de categoria `ameaca_juridica` — isso é responsabilidade do Módulo Jurídico quando for construído; aqui só classificamos e listamos.

### Critérios de aceite
- [ ] RLS force-enabled, isolamento por `campanha_id` (mesmo padrão testado).
- [ ] `embaixador` e `candidato` conseguem ler mas não inserir.
- [ ] Os outros 5 papéis (exceto embaixador/candidato) conseguem inserir.
- [ ] Storage do bucket `monitoramento` isolado por campanha, mesmo padrão testado do `base-conhecimento`.

---

## [2026-07-13] Categorias de monitoramento — ampliação (decisão do usuário)

- **Pergunta do usuário:** quais categorias existem e dá pra cadastrar categoria nova? Resposta honesta: hoje é enum fixo, ninguém cadastra pela tela.
- **Decisão:** manter enum fixo por enquanto (usuário não pediu pra virar tabela cadastrável), mas adicionar 3 categorias: `mencao_positiva`, `mencao_negativa`, `gestao_crise`. Lista final: ameaça jurídica, deepfake suspeito, gestão de crise, menção positiva, menção neutra, menção negativa, oportunidade de marketing, outro.
- **Gravidade** continua só nas categorias que pedem resposta ativa: ameaça jurídica, deepfake suspeito, gestão de crise. A família "menção" (positiva/neutra/negativa) é só sentimento, sem campo de gravidade.
- **Revisitar depois:** se a lista de categorias continuar crescendo por pedido do usuário, vale reconsiderar migrar pra tabela cadastrável em vez de enum — registrado aqui como sinal, não decidido agora.

---

## [2026-07-13] Editar/excluir item + múltiplos arquivos por item (base de conhecimento)

- **Motivo:** usuário testou adicionar "Código eleitoral" com só descrição, quis depois anexar o PDF de verdade — hoje só dá pra criar item novo, não editar o existente nem anexar mais de um arquivo. Confirmado com o usuário: "complementar" = um item pode acumular **vários arquivos** ao longo do tempo (a lei + um resumo + um parecer, por exemplo), não é troca de arquivo único.
- **Escopo:**
  1. Editar título/descrição de um item existente.
  2. Excluir item existente (e seus arquivos).
  3. Arquivos viram tabela própria (`base_conhecimento_arquivos`, item → muitos arquivos), não mais coluna única em `base_conhecimento_itens`. Cada arquivo pode ser adicionado/removido independentemente, sem mexer no resto do item.
- **Migração de dado:** os 2 itens de teste que já têm `arquivo_path` (Biografia PDF) precisam ser migrados pra a tabela nova antes de remover as colunas antigas — não pode perder o que já foi cadastrado.
- **Mudança de regra:** a CHECK `descricao_ou_arquivo` sai do banco (não dá pra checar "existe pelo menos 1 arquivo relacionado" com CHECK simples, exigiria trigger). Vira validação só de UI — o formulário de criação continua exigindo descrição OU arquivo antes de enviar, mas o banco não trava mais isso sozinho.
- **Permissão:** editar/excluir item e adicionar/remover arquivo seguem a mesma regra de quem cria hoje (`coord_campanha`, `coord_marketing`).

### Critérios de aceite
- [ ] Dado existente (Biografia PDF) migrado sem perda pra `base_conhecimento_arquivos`.
- [ ] Editar título/descrição funciona e respeita RLS (só coord_campanha/coord_marketing).
- [ ] Excluir item remove os arquivos associados (linha do banco — limpeza do Storage em si é conhecida como pendência, mesma ressalva já registrada pro bucket órfão do teste anterior).
- [ ] Um item aceita mais de 1 arquivo simultaneamente, cada um com upload/remoção independente.
- [ ] Isolamento cross-tenant testado na tabela nova.

---

## [2026-07-13] "Complementar" também vale pro texto — "Adicionar informação" não substitui

- **Motivo:** usuário deixou claro que editar não pode "anular o conhecimento" já registrado num item — só devia poder acrescentar. "Editar" (substitui título/descrição) já existe e continua, separado, pra correções de verdade.
- **Decisão do usuário:** botão próprio **"Adicionar informação"** — abre uma caixa de texto vazia, o que for digitado é **acrescentado ao final** da descrição existente (separado por linha em branco), nunca substitui. Sem tabela nova (ao contrário dos arquivos) — continua sendo o campo `descricao` único, só a ação de escrever nele que muda.
- **Escopo:** só frontend — nenhuma migration necessária.

---

## [2026-07-13] Mais 3 bases de conhecimento — Atual Conjuntura, Concorrentes, Demandas

- **Atual Conjuntura:** sem schema novo — é mais um tema dentro da base de conhecimento já existente (texto/PDF, igual "Legislação Eleitoral").
- **Concorrentes:** tabela própria. Campos: nome, partido, pontos_fortes, pontos_fracos, promessas. Análise de oposição, não cabe no molde tema+item genérico (campos fixos, não texto livre).
- **Demandas (observadas):** tabela própria. Campos: regiao, cidade, tema (texto livre — saúde, emprego, educação etc.), demanda (descrição). **Confirmado com o usuário: é nota de referência agora** ("esses são os temas que mais recebemos por região"), não o fluxo formal de cidadão-relata/mandato-encaminha já previsto na especificação original (esse continua planejado como módulo próprio, com status e encaminhamento, mais pra frente). Nome da tabela deliberadamente diferente de `demandas` puro pra não colidir quando o módulo de verdade for construído: `demandas_observadas`.
- **Acesso:** mesmo padrão da base de conhecimento — leitura pra qualquer papel interno, edição só `coord_campanha`/`coord_marketing`.

### Critérios de aceite
- [ ] Tabelas `concorrentes` e `demandas_observadas` com RLS force-enabled, isolamento por campanha_id testado.
- [ ] Leitura liberada a todos os papéis internos; edição só coord_campanha/coord_marketing.
- [ ] Tema "Atual Conjuntura" criado na base de conhecimento existente.

---

## [2026-07-15] Módulo 3 — Jurídico: Conformidade e rotulagem IA (planejamento)

- **Objetivo:** implementar a primeira das 3 partes do bloco jurídico (docs/especificacao-v1.md §Camada 3, item 1): registro de toda peça de conteúdo gerada ou significativamente alterada por IA, com rotulagem obrigatória aplicada antes de publicar e bloqueio automático de publicação de conteúdo sintético novo na janela de 72h antes / 24h depois do pleito (Regra de Ouro nº1, CLAUDE.md). Desbloqueia a pendência já registrada no Módulo 4: hoje `sugestoes_conteudo` não tem rotulagem porque isso foi explicitamente adiado para este módulo.
- **Fora desta entrega (registrado, não esquecido):** escudo antideepfake (`evento_ameaca`) e matriz de alertas/encaminhamento formal (`alerta`) — partes 2 e 3 do mesmo bloco, ficam para specs seguintes.

### Decisões confirmadas com o usuário

1. **Janela de bloqueio (72h antes / 24h depois do pleito):** 1º turno é 04/10/2026. Bloqueio ativo de `2026-10-01 00:00` a `2026-10-05 00:00` (horário de Brasília), constante fixa em função SQL (`dentro_janela_bloqueio()`), não campo configurável por campanha — todas as campanhas do sistema disputam a mesma eleição geral. **Não cobre eventual 2º turno** (data ainda não definida) — fica para revisão quando/se houver 2º turno confirmado.
2. **Quem aprova (rotulagem = revisão humana obrigatória):** `coord_marketing`/`redator_marketing`/`coord_campanha` criam a peça (rascunho). Aprovação (`rotulo_aplicado=true` + `aprovador_id` + liberar publicação) é de **`advogado_responsavel`, `assistente_juridico`, `coord_campanha` e `coord_marketing`** — usuário decidiu incluir `coord_marketing` no grupo de aprovação, não só o jurídico. `redator_marketing` fica de fora da aprovação (só autor).
3. **Escopo desta entrega:** schema + RLS + testes reais **e frontend juntos** (usuário decidiu não segmentar como nos módulos anteriores) — tela de peças (criar rascunho, aprovar/rotular, publicar) entra nesta mesma tarefa.

### Modelo de dados

**`pecas_conteudo`**
- `id` uuid pk
- `campanha_id` uuid fk → campanhas.id, not null
- `tipo` text check in ('post', 'whatsapp', 'carrossel', 'roteiro_video', 'audio', 'video', 'imagem', 'outro') — mesmo vocabulário de formato usado em `sugestoes_conteudo` (Módulo 4)
- `usou_ia` boolean not null default false — cobre "gerado ou significativamente alterado por IA" como um único campo (simplificação; nota de decisão técnica se o Programador achar que precisa de dois campos)
- `ferramenta` text nullable — nome da ferramenta/modelo de IA usado, quando `usou_ia = true`
- `sugestao_conteudo_id` uuid fk → sugestoes_conteudo.id, nullable — rastreabilidade opcional para quando a peça nasce de uma sugestão do Módulo 4
- `prompt` text nullable — contexto/prompt usado, quando aplicável
- `rotulo_aplicado` boolean not null default false
- `rotulo_texto` text nullable — snapshot do texto do rótulo exibido (auditável, não recalculado depois)
- `aprovador_id` uuid fk → usuarios_internos.id, nullable — obrigatório antes de `status = 'publicado'`
- `canal` text check in ('site', 'whatsapp', 'instagram', 'tiktok', 'facebook', 'radio', 'tv', 'outro')
- `status` text check in ('rascunho', 'aprovado', 'publicado', 'bloqueado_janela') default 'rascunho'
- `publicado_em` timestamptz nullable
- `criado_por` uuid fk → usuarios_internos.id, not null
- `criado_em` timestamptz default now()

### Regras de trava (banco, não só validação de UI)

1. **CHECK/trigger de rotulagem:** não permite transição para `status = 'publicado'` se `usou_ia = true` e `rotulo_aplicado = false`. Peça sem IA (`usou_ia = false`) não exige rótulo.
2. **CHECK/trigger de aprovação:** não permite `status = 'publicado'` sem `aprovador_id` preenchido — revisão humana obrigatória, mesmo com rótulo aplicado.
3. **Trigger de bloqueio de janela:** não permite `INSERT` ou transição para `status = 'publicado'` de uma peça nova com `usou_ia = true` enquanto `dentro_janela_bloqueio()` for verdadeiro. Peça já publicada antes da janela começar não é afetada retroativamente.
4. **Separação de poder (RLS):** `redator_marketing` não pode gravar `rotulo_aplicado = true` nem `aprovador_id` (mesmo tentando via UPDATE direto) — só `advogado_responsavel`, `assistente_juridico`, `coord_campanha`, `coord_marketing`.

### Acesso (RLS)

- **Leitura:** todos os papéis internos da campanha (dossiê de defesa precisa ser consultável por todo mundo, especialmente jurídico).
- **INSERT (rascunho):** `coord_marketing`, `redator_marketing`, `coord_campanha`.
- **UPDATE de aprovação** (`rotulo_aplicado`, `rotulo_texto`, `aprovador_id`, `status→publicado`): `advogado_responsavel`, `assistente_juridico`, `coord_campanha`, `coord_marketing` apenas.
- **UPDATE de conteúdo/rascunho** (antes de aprovado): mesmo conjunto do INSERT.
- Isolamento por `campanha_id` no mesmo padrão testado nos módulos 1/2/4.

### Critérios de aceite
- [ ] RLS force-enabled, isolamento cross-tenant testado (mesmo padrão dos módulos anteriores).
- [ ] `redator_marketing` cria rascunho mas não consegue setar `rotulo_aplicado`/`aprovador_id` diretamente.
- [ ] `advogado_responsavel`/`assistente_juridico`/`coord_campanha`/`coord_marketing` conseguem aprovar (aplicar rótulo + publicar).
- [ ] Peça com `usou_ia = true` e `rotulo_aplicado = false` não consegue ir para `status = 'publicado'` (trigger/CHECK bloqueia).
- [ ] Peça com `usou_ia = true`, `rotulo_aplicado = true`, mas sem `aprovador_id` também não consegue publicar.
- [ ] Dentro da janela de bloqueio (simular data), INSERT/publicação de peça nova com `usou_ia = true` falha; peça sem IA não é afetada.
- [ ] Fora da janela, o mesmo fluxo funciona normalmente.
- [ ] Frontend: tela lista peças da campanha (todos os papéis leem).
- [ ] Frontend: `coord_marketing`/`redator_marketing`/`coord_campanha` conseguem criar rascunho de peça.
- [ ] Frontend: `advogado_responsavel`/`assistente_juridico`/`coord_campanha`/`coord_marketing` veem ação de aprovar/rotular; `redator_marketing` não vê essa ação (ou vê e recebe erro de RLS, nunca contorna).
- [ ] Frontend: peça publicada mostra o rótulo aplicado de forma visível (não é só um campo de banco).

### Risco TSE/LGPD
- Alto se a trava falhar: publicar conteúdo sintético sem rótulo, ou dentro da janela de silêncio, é a violação central que a Regra de Ouro nº1 existe para prevenir — risco de multa/cassação direto, não hipotético.
- Trava precisa ser de banco (trigger/CHECK), não só de aplicação — mesmo padrão de defesa em profundidade já aplicado em `log_auditoria`/`consentimentos_lgpd` (Módulo 1), porque um bug de frontend não pode ser a única coisa entre o sistema e uma publicação ilegal.

### Dependências
- Reaproveita `current_campanha_id()`/`current_papel()` (Módulo 1) e papéis já existentes (`advogado_responsavel`, `assistente_juridico`, `coord_marketing`, `redator_marketing`, `coord_campanha` — migrations 0005/0006).
- `sugestao_conteudo_id` referencia `sugestoes_conteudo` (Módulo 4, migration 0011) — já existe.
- Decisões acima já confirmadas com o usuário — liberado para o Programador escrever a migration + frontend.

---

## [2026-07-15] Módulo 4 — Marketing (planejamento)

- **Escopo confirmado com o usuário:**
  1. Transformar propostas/diretrizes em sugestões de múltiplos formatos (post, WhatsApp, carrossel, roteiro de vídeo).
  2. Analisar a campanha e identificar pontos cegos — cruzando propostas próprias com **concorrentes** e **demandas observadas** já cadastrados.
  3. FAQs/perguntas recorrentes — **tabela própria** (pergunta + resposta), pra alimentar padrão de conteúdo.
- **Decisão de escopo crítica (esclarecida pelo usuário):** a IA **não produz arte final nem publica** — só sugere texto/estrutura (ex.: "carrossel com este texto", "vídeo que transmita isso"). Quem executa a arte/vídeo e publica é humano. Por isso:
  - **Sem rotulagem visível obrigatória nesta entrega** (isso é responsabilidade de quando o conteúdo é de fato publicado, papel do Módulo Jurídico).
  - **Com registro de auditoria leve em toda chamada de IA** (modelo, prompt, quem pediu, quando) — satisfaz o espírito da Regra de Ouro nº1 sem construir o mecanismo pesado de bloqueio/rótulo agora.
- **Provedor de IA:** Claude (Anthropic), via API key fornecida pelo usuário (conta própria, criada por ele em console.anthropic.com — fora do que a automação consegue fazer). Chave fica só server-side (Route Handler), nunca no client.
- **Dependência bloqueante:** a geração de verdade (chamada à API) não liga sem a API key. Schema/telas seguem sendo construídos e testados sem ela.
- **Nota sobre RAG/PDF:** propostas cadastradas como PDF anexado (padrão atual da base de conhecimento) não têm o texto extraído — não servem de contexto pra IA. Propostas que devem alimentar a geração de conteúdo precisam entrar como **texto digitado** no item (campo `descricao`), não só arquivo. Extração de texto de PDF fica fora do escopo desta entrega.

### Modelo de dados
- **`faqs`** — campanha_id, pergunta, resposta, criado_por, created_at. Edição: `coord_campanha`, `coord_marketing` **e `redator_marketing`** (diferente da base de conhecimento — FAQ é material de conteúdo do dia a dia, não fato institucional trancado a sênior). Leitura: todos os papéis internos.
- **`sugestoes_conteudo`** — campanha_id, formato (`post`, `whatsapp`, `carrossel`, `roteiro_video`, `outro`), contexto_usado (texto — o que foi mandado como base pra IA, ex. a proposta selecionada), modelo_ia, sugestao (resposta da IA), solicitado_por, created_at.
- **`analises_campanha`** — campanha_id, tipo (`pontos_cegos` por enquanto, extensível), analise (resposta da IA), modelo_ia, solicitado_por, created_at.
- **Acesso de `sugestoes_conteudo`/`analises_campanha`:** criação (chamar a IA) por `coord_campanha`, `coord_marketing`, `redator_marketing`; leitura por todos os papéis internos (histórico é útil pra todo mundo ver o que já foi sugerido).

### Critérios de aceite
- [ ] RLS force-enabled + isolamento cross-tenant testado nas 3 tabelas novas, mesmo padrão já validado.
- [ ] `redator_marketing` consegue criar FAQ (diferente do padrão de base de conhecimento).
- [ ] Rota de geração de sugestão: autentica, monta contexto (proposta selecionada), chama Anthropic, grava em `sugestoes_conteudo` com metadado completo, retorna sugestão.
- [ ] Rota de análise de pontos cegos: monta contexto de propostas + concorrentes + demandas_observadas da campanha, chama Anthropic, grava em `analises_campanha`.
- [ ] UI deixa claro que é sugestão pra revisão humana, não conteúdo pronto pra publicar.

---

## [2026-07-15] Módulo 3 — Jurídico: Escudo antideepfake (planejamento)

- **Objetivo:** implementar a segunda das 3 partes do bloco jurídico (docs/especificacao-v1.md §Camada 3, item 2): "monitora, detecta conteúdo fabricado contra o candidato, arquiva com carimbo de data/hora (prova de existência mesmo após remoção), monta o dossiê técnico."
- **Decisão de arquitetura (confirmada com o usuário):** **não** criar a tabela `evento_ameaca` separada que a especificação original desenha. Em vez disso, **estender `monitoramento_itens`** (já existente, migration 0007/0008) com os campos forenses que faltam. Motivo: o próprio registro de quando `monitoramento_itens` foi construído já deixou anotado que o encaminhamento formal "é responsabilidade do Módulo Jurídico quando for construído" — ou seja, a intenção sempre foi o jurídico evoluir em cima do mesmo registro, não duplicar a mesma menção em duas tabelas (uma vista pelo marketing, outra pelo jurídico).
- **Trade-off aceito:** desvia da especificação original (que trata `evento_ameaca` como entidade própria) em troca de não ter duas tabelas rastreando a mesma menção. Registrado aqui porque contradiz o texto de origem — mesma prática já usada na entrada de reorganização de papéis.
- **Fora desta entrega:** matriz de alertas + encaminhamento formal à Justiça Eleitoral (parte 3 do bloco) — continua depois desta.

### Decisões confirmadas com o usuário

1. **Categorias que recebem hash de evidência + imutabilidade:** as 3 categorias de ameaça que já têm campo `gravidade` hoje — `deepfake_suspeito`, `ameaca_juridica`, `gestao_crise`. As demais (menções de sentimento, oportunidade de marketing, outro) não geram prova forense.
2. **Cálculo do hash SHA-256:** **client-side**, via Web Crypto (`crypto.subtle.digest`) no navegador, no momento do registro do item — antes/durante o upload da captura. Decisão minha (usuário pediu para eu decidir): mais simples, não muda a arquitetura de upload direto do cliente pro Storage já usada em todo o resto do sistema. **Limitação a documentar na UI/dossiê, não esconder:** isso é prova de "cadeia de custódia" (chain of custody) — hash calculado por um usuário interno autenticado, no mesmo nível de confiança do resto do sistema — **não é** um carimbo de tempo de autoridade externa (RFC 3161) nem prova criptográfica à prova de um usuário interno mal-intencionado. Suficiente para montar o dossiê técnico e dar ao advogado uma trilha defensável; se for necessário para submissão judicial formal, pode exigir notarização externa — fora do escopo desta entrega.
3. **Escopo desta entrega:** schema + frontend juntos (mesmo padrão da parte 1 — conformidade e rotulagem IA).

### Modelo de dados (alteração em `monitoramento_itens`, migration 0013)

- **`hash_evidencia`** TEXT nullable — SHA-256 hex (64 caracteres) do arquivo de captura, calculado no cliente no momento do registro.
- **`hash_calculado_em`** TIMESTAMPTZ nullable — quando o hash foi calculado (carimbo de data/hora local à inserção, não uma autoridade externa).
- **CHECK `hash_so_para_ameaca`:** `hash_evidencia IS NULL OR categoria IN ('deepfake_suspeito', 'ameaca_juridica', 'gestao_crise')` — trava estrutural que impede hash em categoria fora do escopo de ameaça (e, como efeito colateral, impede também "esvaziar" a prova trocando a categoria depois, porque o CHECK é revalidado em todo UPDATE da linha).
- **CHECK `hash_par_completo`:** `(hash_evidencia IS NULL) = (hash_calculado_em IS NULL)` — os dois campos existem juntos ou nenhum dos dois.
- Só computa hash quando há arquivo de captura (`captura_path IS NOT NULL`) — item de ameaça só com texto/descrição (sem captura) não tem o que hashear; fica sem prova forense, o que é uma limitação honesta, não um bug.

### Regra de imutabilidade (trigger, não só CHECK)

Uma vez que `hash_evidencia` é preenchido (evidência "lacrada"), um trigger `BEFORE UPDATE` bloqueia qualquer alteração posterior em `descricao`, `url`, `captura_path`, `hash_evidencia` ou `hash_calculado_em` — é a garantia de "prova de existência mesmo após remoção" do conteúdo original (a linha do banco vira a prova, e ela não pode ser adulterada depois de lacrada). `status` e `gravidade` continuam editáveis livremente (o item pode evoluir de "novo" pra "em_analise"/"resolvido" sem tocar na evidência em si). Mesmo padrão de defesa em profundidade já usado em `log_auditoria`/`consentimentos_lgpd` (Módulo 1) e na separação de poder de `pecas_conteudo` (Módulo 3 parte 1) — construído mesmo sem existir ainda uma tela de edição de `monitoramento_itens` (só há tela de criação hoje), por disciplina de "trigger antes da UI que dependeria dele".

### Dossiê técnico (frontend)

- Nova página `/dossie-juridico`: lista os itens de `monitoramento_itens` com `hash_evidencia IS NOT NULL` (evidência lacrada), ordenados por data, com descrição, categoria, gravidade, hash, data do hash, link de origem e botão de baixar a captura (reaproveita o padrão do `VerCapturaButton` já existente em `/monitoramento`).
- **Sem RLS nova:** é só um filtro de leitura sobre dado que a policy `monitoramento_itens_select` já libera pra todos os papéis internos — a página não abre acesso novo, só reorganiza a visão pro jurídico.
- `/monitoramento`: item de categoria de ameaça com captura mostra selo "Evidência lacrada" quando `hash_evidencia` está presente.

### Critérios de aceite
- [ ] Migration adiciona as 2 colunas + 2 CHECKs em `monitoramento_itens`, sem quebrar dado existente (colunas nullable, itens antigos ficam com hash nulo).
- [ ] Trigger de imutabilidade: depois de `hash_evidencia` preenchido, UPDATE que tenta mudar `descricao`/`url`/`captura_path`/`hash_evidencia`/`hash_calculado_em` falha; UPDATE que só muda `status`/`gravidade` continua funcionando.
- [ ] CHECK impede hash em categoria fora das 3 de ameaça, inclusive tentando trocar a categoria depois de já ter hash.
- [ ] Frontend: registrar item de categoria de ameaça com arquivo calcula e grava hash + timestamp automaticamente, sem ação manual extra do usuário.
- [ ] Frontend: item sem categoria de ameaça (ou sem arquivo) não recebe hash.
- [ ] Frontend: `/dossie-juridico` lista só os itens com evidência lacrada, com download de captura funcionando.
- [ ] Isolamento cross-tenant testado na visão do dossiê (mesmo padrão já validado em `monitoramento_itens`).

### Risco TSE/LGPD
- Médio: o valor deste módulo é ter prova defensável em caso de deepfake/desinformação contra o candidato. Se a trava de imutabilidade falhar, a "prova" perde valor jurídico (poderia ser alegado que foi adulterada depois).
- Risco de super-promessa: é importante que a UI do dossiê não afirme "prova criptográfica inviolável" — só "registro de cadeia de custódia interna", para não criar expectativa jurídica que o sistema não cumpre (ver limitação do hash client-side acima).

### Dependências
- Reaproveita `monitoramento_itens`, `current_campanha_id()`, papéis já existentes — nenhuma tabela nova, nenhuma policy de RLS nova.
- Decisões acima já confirmadas com o usuário — liberado para o Programador escrever a migration + frontend.

---

## [2026-07-15] Remodelagem do campo — Lideranças (sem login), metas, tarefas e mapa de cobertura

- **Objetivo:** substituir o modelo "embaixador com login + app offline" pelo modelo real de operação do cliente: a **liderança** é uma pessoa de campo SEM acesso ao sistema, que traz formulários físicos preenchidos de eleitores; a equipe digita esses cadastros no sistema atribuindo-os à liderança. Inclui metas de cadastro (por liderança, por bairro/território e geral), painel de tarefas da equipe e mapa de cobertura por bairro (referências visuais: screenshots de produto concorrente fornecidos pelo usuário — reproduzir o conceito, sem o "link de cadastro público").

### Decisões confirmadas com o usuário
1. **Liderança não tem login.** Vira registro gerenciado (nome, telefone, cidade, bairro, status ativa/inativa). O papel `embaixador` continua existindo no banco (renomeação/remoção só de interface — decisão "só na interface"), mas some do formulário de convite; app offline e cadastro em campo por login deixam de ser roadmap.
2. **Metas completas como a referência:** meta por liderança, por bairro/território e campanha geral, com progresso calculado (cadastros e, opcionalmente, apoiadores).
3. **Tarefas com responsável em texto livre** (ex.: "Equipe campo", "Comunicação"), como a referência.
4. **Mapa de geolocalização incluído nesta entrega** (pedido explícito do usuário na mesma resposta).
5. **Sem link de cadastro público** — explícito do usuário.

### Decisões do Planejador (registradas, não perguntadas — derivadas do que já está testado)
- **Quem digita os formulários: `coord_campanha`.** A migration 0006 exclui deliberadamente marketing/jurídico de PII de cidadão (`cidadaos_select`); abrir INSERT pra marketing agora contradiria esse modelo testado. Se o cliente precisar de um papel "equipe de dados", vira papel novo em spec futura.
- **Origem do cadastro:** novo valor de enum `formulario_lideranca` em `origem_cadastro_cidadao` + CHECK exigindo `lideranca_id` quando essa é a origem. A trava "nunca por importação/lista comprada" continua intacta (enum fechado).
- **Consentimento:** novo canal `formulario_fisico` em `canal_consentimento` (o canal `porta_a_porta` exige geolocalização da coleta, que não existe num formulário de papel digitado depois).
- **Meta por liderança mora na tabela `metas`** (tipo `lideranca`), não em coluna própria — uma única fonte de verdade; a coluna "Meta" da tabela de lideranças lê de lá.
- **Progresso é derivado, nunca armazenado:** cadastros = count de `cidadaos` por `lideranca_id`/território/campanha; apoiadores = count com `circulo = 'quente'`; período mensal conta só `created_at` do mês corrente.
- **Coordenada do mapa:** território ganha `cidade` e `centro` (ponto). O centro é definido no formulário de território — busca por bairro+cidade via Nominatim/OpenStreetMap (só nome de bairro/cidade, nenhum dado pessoal sai do sistema) ou digitação manual de lat/lng. Cidadão NÃO é geocodificado individualmente (formulário de papel não tem coordenada); ele conta no círculo do território. Cidadãos sem território com centro definido entram no aviso "N sem coordenada no mapa".
- **Legado mantido sem remoção:** policy `cidadaos_insert_embaixador`, CHECK `embaixador_coletor_obrigatorio` e o valor `embaixador` do enum ficam como estão (inofensivos, evita retestar o que já passou).

### Migrations (0014 enum-only + 0015 tabelas/policies — mesmo padrão da dupla 0005/0006)
- **0014:** `ALTER TYPE origem_cadastro_cidadao ADD VALUE 'formulario_lideranca'`; `ALTER TYPE canal_consentimento ADD VALUE 'formulario_fisico'`; tipos novos `status_lideranca` (ativa/inativa), `tipo_meta` (lideranca/territorio/geral), `periodo_meta` (mensal/total), `status_tarefa` (a_fazer/em_progresso/concluida).
- **0015:**
  - `liderancas`: id, campanha_id, nome, telefone, cidade, bairro, territorio_id FK nullable, status default 'ativa', criado_por, created_at.
  - `metas`: id, campanha_id, tipo, lideranca_id FK nullable, territorio_id FK nullable, periodo default 'total', alvo_cadastros NOT NULL, alvo_apoiadores nullable, criado_por, created_at. CHECKs de coerência: tipo lideranca → só lideranca_id; tipo territorio → só territorio_id; tipo geral → nenhum dos dois.
  - `tarefas`: id, campanha_id, titulo, responsavel TEXT, status default 'a_fazer', prazo DATE nullable, criado_por, created_at.
  - `cidadaos`: ADD `lideranca_id` FK nullable + CHECK `formulario_lideranca_exige_lideranca`.
  - `territorios`: ADD `cidade` TEXT, `centro` GEOGRAPHY(POINT).
  - RLS (todas force-enabled): liderancas — SELECT todos os papéis internos, INSERT/UPDATE coord_campanha+coord_marketing, sem DELETE (desativa via status). metas — SELECT todos, INSERT/UPDATE/DELETE coord_campanha+coord_marketing. tarefas — SELECT todos, INSERT/UPDATE todos exceto candidato e embaixador, DELETE coord_campanha. cidadaos — nova policy INSERT p/ coord_campanha com origem `formulario_lideranca` e liderança da própria campanha (EXISTS sob RLS).
  - GRANTs explícitos + REVOKE de `anon` nas 3 tabelas novas (lição da migration 0002 — default privileges do Supabase).

### Frontend
- **/liderancas:** tabela como a referência (Nome, Cidade, Bairro, Telefone, Cadastros, Meta, Progresso %, Status) + busca + form "Nova liderança" + seção "Metas da campanha" (criar meta por liderança/bairro/geral com alvo e período; barra de progresso; excluir). Sem link público.
- **/tarefas:** lista (Título, Responsável, Status com badge, Prazo) + form "Nova tarefa" + troca de status inline.
- **/cidadaos (novo — digitação de formulários):** form nome, whatsapp, território, liderança (obrigatória), círculo, temas + consentimento (finalidade, texto aceito, canal formulario_fisico); lista dos últimos digitados. Visível só pra quem lê cidadãos (coord_campanha, candidato — e só coord digita).
- **/geolocalizacao:** mapa Leaflet/OpenStreetMap; círculo por território com centro (raio proporcional a cadastros; cor por % da meta do território: sem meta = azul, <70% vermelho, 70–99% âmbar, 100%+ verde); popup bairro/cadastros/lideranças/meta; aviso "N sem coordenada"; toggle pra plotar eleitores que tenham coordenada própria (legado embaixador).
- **/usuarios:** remove "Embaixador" das opções de convite (papel legado); TerritorioForm ganha cidade + busca de coordenada (Nominatim) / lat-lng manual.
- **AppHeader:** entram Lideranças, Tarefas, Cidadãos, Mapa.

### Critérios de aceite
- [ ] RLS force-enabled + isolamento cross-tenant testado nas 3 tabelas novas (real, staging).
- [ ] coord_campanha digita cidadão com origem formulario_lideranca + liderança da própria campanha; liderança de OUTRA campanha é rejeitada.
- [ ] Cidadão com origem formulario_lideranca sem lideranca_id é rejeitado (CHECK).
- [ ] Marketing NÃO consegue digitar cidadão (INSERT bloqueado) — modelo de PII preservado.
- [ ] Metas: CHECKs de coerência tipo/FK; DELETE só coordenação/marketing.
- [ ] Tarefas: candidato não cria/edita; demais papéis sim; DELETE só coord_campanha.
- [ ] Frontend: tabela de lideranças mostra cadastros (count real), meta e progresso; status ativa/inativa.
- [ ] Frontend: tarefas com badges de status como a referência.
- [ ] Frontend: mapa renderiza círculos nos territórios com centro e popup com os números; aviso de "sem coordenada" correto.
- [ ] Convite de embaixador some da UI.

### Risco TSE/LGPD
- Liderança é PII de apoiador (nome+telefone) — leitura liberada a todos os papéis internos da campanha (diferente de cidadão): decisão registrada para o Revisor, reversível por policy.
- A trava anti-importação continua: a única porta nova de entrada de cidadão é digitação manual pela coordenação, um a um, com consentimento registrado (formulário físico assinado é a base do aceite; o texto aceito vai no consentimento).
- Nominatim recebe apenas "bairro, cidade" — nunca nome/telefone/endereço de pessoa.

### Dependências
- Token de acesso Supabase (o da sessão pode ter sido revogado — pedir novo se `db push` falhar).
- `react-leaflet`/`leaflet` no apps/web.

---

## [2026-07-16] Módulo 3 — Jurídico parte 3: Matriz de alertas + encaminhamento (fecha o bloco jurídico)

- **Objetivo:** última peça do bloco jurídico. Quando um item de ameaça grave é registrado no monitoramento, o sistema gera um alerta automaticamente pros papéis certos; o advogado responsável tem um botão pra marcar que já encaminhou o caso à Justiça Eleitoral (registro simples, não integração com o TSE).

### Decisões confirmadas com o usuário
1. **Gatilho automático:** todo `monitoramento_itens` com categoria de ameaça (`ameaca_juridica`, `deepfake_suspeito`, `gestao_crise`) e `gravidade = 'alta'` gera alerta na hora — sem matriz configurável nesta entrega (destinatários fixos: `advogado_responsavel` + `coord_campanha`).
2. **Canal: WhatsApp.** Decisão do usuário. **Mas sem provedor definido ainda** (Twilio/Meta Cloud API/outro) — usuário pediu pra configurar depois. Mesma dependência bloqueante já registrada pro Módulo 4 com a chave da Anthropic: schema, trigger, fila de envio e tela ficam prontos e testados agora; o envio de WhatsApp de verdade liga quando houver credencial de provedor. Até lá, o alerta é 100% visível dentro do sistema (`/alertas`) — ninguém fica sem o aviso, só não chega no celular ainda.
3. **Encaminhamento simplificado:** não é abertura de processo nem protocolo — é só o `advogado_responsavel` marcando "já encaminhei à Justiça Eleitoral" num alerta, com data (automática) e nota opcional (ex.: número de processo, se quiser anotar). Exclusivo desse papel — nenhum outro consegue marcar.

### Modelo de dados (migration 0017)
- **`alertas`**: id, campanha_id, monitoramento_item_id FK, destinatario_papel (o papel, não um usuário específico — dispara pra todo mundo daquele papel na campanha), canal default 'whatsapp', status_envio (`pendente_configuracao` / `enviado` / `falhou`) default `pendente_configuracao`, erro_envio TEXT nullable, lido_em TIMESTAMPTZ nullable (por usuário seria mais correto, mas simplifica pra "lido por alguém" nesta entrega — nota de simplificação), encaminhado_por FK usuarios_internos nullable, encaminhado_em TIMESTAMPTZ nullable, encaminhado_nota TEXT nullable, created_at.
- **`usuarios_internos`**: ADD `telefone` TEXT nullable — precisa pra saber pra onde mandar o WhatsApp quando o envio ligar. Adicionado ao formulário de convite.
- Trigger `AFTER INSERT` em `monitoramento_itens`: se categoria de ameaça + gravidade alta, insere 1 linha em `alertas` por papel destinatário (2 linhas: advogado_responsavel, coord_campanha) — a fila fica pronta, mesmo sem envio real ainda. Trigger só grava no banco; a chamada HTTP pro provedor de WhatsApp (quando existir) roda na aplicação (Route Handler), não em Postgres — mesmo padrão de "IA roda na aplicação, não no banco" já usado no Módulo 4.

### Frontend
- **`/alertas`**: lista alertas da campanha (mais recente primeiro), mostra o item de ameaça relacionado (descrição, categoria, gravidade, link/captura), status de envio (com aviso "envio de WhatsApp ainda não configurado" quando `pendente_configuracao`), botão "Marcar como lido". Pro `advogado_responsavel`: botão extra "Marcar encaminhamento à Justiça Eleitoral" com campo de nota opcional — some depois de marcado, vira um selo "Encaminhado em [data] por [nome]".
- Sino/contador de alertas não lidos no `AppHeader` (opcional, se couber sem quebrar o layout).

### Critérios de aceite
- [ ] Inserir `monitoramento_itens` com categoria de ameaça + gravidade alta gera 2 alertas automaticamente (advogado_responsavel, coord_campanha); gravidade baixa/média ou categoria não-ameaça não gera nada.
- [ ] RLS: leitura de alertas liberada a todos os papéis internos (mesmo padrão de monitoramento); só `advogado_responsavel` marca encaminhamento.
- [ ] `coord_marketing`/`redator_marketing` não conseguem marcar encaminhamento (tentativa bloqueada).
- [ ] Isolamento cross-tenant testado.
- [ ] Frontend mostra claramente que o envio de WhatsApp está pendente de configuração — sem fingir que foi enviado.

### Risco TSE/LGPD
- Baixo/médio: isso é uma camada de notificação interna, não uma ação jurídica formal — o encaminhamento real à Justiça continua sendo feito pelo advogado fora do sistema; o sistema só registra que aconteceu. Não há risco de o sistema "prometer" ter protocolado algo que não protocolou, porque o campo é literalmente "nota", não um número de processo validado.

### Dependências
- **Bloqueante para envio real de WhatsApp:** credenciais de provedor (Twilio, Meta Cloud API, ou outro) — usuário decidiu configurar depois. Schema/trigger/tela seguem sem isso.
- `telefone` em `usuarios_internos` (novo campo) precisa ser preenchido nos convites futuros; usuários já existentes ficam sem telefone até serem editados (fora de escopo desta entrega — não há tela de editar usuário existente ainda).

---

## [2026-07-16] Módulo Relacionamento — parte 1: Cadastro de apoiadores

- **Contexto:** antes de construir qualquer coisa do bloco relacionamento (enquete, loop de demanda, histórico de mandato), conversamos sobre escopo. Ficou definido: (1) o cidadão nunca interage direto com o sistema — só recebe informação, mesmo modelo de sempre, sem superfície pública nova; (2) "rede de embaixadores" da especificação original já foi resolvida pelo módulo Lideranças (falta só reconhecimento, que fica pra depois); (3) primeira peça nova a construir é um **cadastro de apoiadores** — pessoas que se oferecem pra ajudar a campanha (não necessariamente cidadão/eleitor já cadastrado).

### Decisões confirmadas com o usuário
1. **O que capturar:** como o apoiador pode ajudar (disponibilidade, forma de ajuda — transporte, espaço pra reunião, redes sociais, distribuição de material, tempo voluntário), não histórico de engajamento (fica pra depois, se for o caso).
2. **Tabela própria, separada de `cidadaos`** — apoiador pode existir sem ainda ser cidadão cadastrado.
3. **Sem consentimento LGPD formal (mais leve que o fluxo de cidadão).** Base legal proposta: legítimo interesse pra coordenação interna de voluntários — decisão do usuário, registrada aqui pro Revisor validar com o advogado do cliente; é uma postura mais leve que o resto do sistema (que sempre exige consentimento explícito registrado).
4. **Liga a um cidadão já cadastrado quando possível** (campo opcional `cidadao_id`), pra não duplicar nome/telefone da mesma pessoa em duas tabelas.

### Decisões do Planejador (registradas, não perguntadas)
- **Conflito resolvido — quem pode ligar a um cidadão:** `cidadao_id` só pode ser setado/alterado por `coord_campanha`. Motivo: `coord_marketing` (que também gerencia apoiadores) não tem acesso a dado nominal de `cidadaos` (regra da migration 0006) — deixá-lo escolher um `cidadao_id` livremente contornaria essa trava (ele teria que adivinhar o ID, ou pior, eu teria que construir uma busca que vaza nome de cidadão pra quem não deveria ver). Reforçado por trigger, mesmo padrão de separação de poder já usado em `pecas_conteudo`/`alertas`.
- **RLS geral (leitura/gestão) espelha `liderancas`:** leitura liberada a todos os papéis internos (apoiador não carrega o mesmo nível de sensibilidade de "eleitor nominal" — é voluntário, categoria mais próxima de liderança); gestão (insert/update) por `coord_campanha` + `coord_marketing`; sem DELETE (só status ativo/inativo).
- **`forma_ajuda` é enum de múltipla escolha** (`forma_ajuda_apoiador[]`), não texto livre — mantém consistência com o resto do sistema (categorias controladas + campo de detalhe livre pra especificar).
- **Nota de risco TSE (não construída ainda, só sinalizada):** a opção "doação de material" no formulário leva um aviso de que doação em espécie pode ter implicação na prestação de contas eleitoral (Lei 9.504/1997) — texto de alerta na UI, não um fluxo de compliance completo nesta entrega.

### Modelo de dados (migration 0019)
- `status_apoiador` ENUM ('ativo', 'inativo').
- `forma_ajuda_apoiador` ENUM ('transporte', 'espaco_reuniao', 'redes_sociais', 'distribuicao_material', 'tempo_voluntario', 'doacao_material', 'outro').
- `apoiadores`: id, campanha_id, nome, telefone NOT NULL, cidade, bairro, territorio_id FK nullable, cidadao_id FK nullable, formas_ajuda `forma_ajuda_apoiador[]` default `{}`, detalhe_ajuda TEXT, disponibilidade TEXT, status default 'ativo', criado_por, created_at.
- Trigger: só `coord_campanha` seta/altera `cidadao_id`; quando setado, precisa pertencer à mesma `campanha_id` (defesa em profundidade contra erro/tentativa cross-tenant).

### Frontend
- **`/apoiadores`:** tabela (nome, telefone, cidade/bairro via `labelTerritorio`, formas de ajuda em badges, disponibilidade, cidadão vinculado se houver, status) + busca + form "Novo apoiador". Campo de vincular cidadão só aparece pra `coord_campanha` (os outros papéis não veem a opção, nem conseguiriam preencher — não têm acesso de leitura a `cidadaos` pra escolher).

### Critérios de aceite
- [ ] RLS force-enabled + isolamento cross-tenant testado (real, staging).
- [ ] `coord_marketing` cria apoiador (positivo) sem `cidadao_id`.
- [ ] `coord_marketing` NÃO consegue setar `cidadao_id` (trigger bloqueia).
- [ ] `coord_campanha` cria/edita apoiador COM `cidadao_id` de um cidadão da própria campanha (positivo).
- [ ] `cidadao_id` de campanha diferente é rejeitado.
- [ ] `candidato` lê apoiadores (positivo, leitura liberada a todos) mas não cria.
- [ ] Frontend: campo de vincular cidadão não aparece pra quem não é coord_campanha.

### Risco TSE/LGPD
- Médio: base legal mais leve que o resto do sistema (legítimo interesse, não consentimento explícito) — decisão de produto que o Revisor deve confirmar com o jurídico do cliente antes de usar em campanha real. "Doação de material" tem aviso na UI, sem trava de compliance.

### Dependências
- Nenhuma nova — reaproveita `territorios`, `cidadaos` (link opcional), papéis já existentes.

---

## [2026-07-16] Decisão de escopo: nada pós-eleição por enquanto

Usuário decidiu: **histórico de mandato sai do escopo atual**, e mais amplamente — **qualquer peça que só faz sentido depois da eleição (governar, não fazer campanha) fica de fora por enquanto**. Motivo alinhado com o resto do projeto: o sistema está sendo construído pra correr contra o calendário eleitoral (propaganda a partir de 16/08, votação em 04/10) — só depois do pleito é que "assinatura de gabinete" vira prioridade real.

Isso deixa **"loop de demanda legislativa"** em situação ambígua: a especificação original descreve encaminhamento via emenda/requerimento/projeto de lei — ações que só existem se quem recebe a demanda já tem mandato (candidato à reeleição, não candidato de primeira viagem). Fica registrado como pergunta em aberto pro usuário antes de especificar essa peça: ela entra agora (só faz sentido pra incumbentes) ou espera junto com histórico de mandato?

Do Bloco Relacionamento, com essa decisão, resta como claramente pré-eleição: **enquete e plano de governo**.

---

## [2026-07-16] Cadastro de mensagens (envio individual, ligado a destinatário já cadastrado)

- **Objetivo:** log/envio de mensagem individual (não em massa — trava estrutural, não só política, ver abaixo) pra um destinatário já cadastrado (eleitor, apoiador ou liderança), com destinatário, canal, status e data.

### Decisões confirmadas com o usuário
1. **Destinatário liga a cadastro já existente** — não é texto livre. Precisa ser exatamente um de: eleitor, apoiador, liderança.
2. **Guarda o conteúdo da mensagem também**, não só metadado.
3. **Deve disparar de verdade** — não é só um registro manual do que já foi enviado por fora.

### Decisões do Planejador (registradas, não perguntadas)
- **Sem provedor de WhatsApp configurado ainda** (mesma dependência bloqueante do Módulo 3 — matriz de alertas). "Disparar de verdade" fica pronto na arquitetura (Route Handler que tentaria enviar), mas o resultado prático agora é sempre `status = 'pendente_configuracao'`, igual alertas. Quando o usuário fornecer credencial de provedor, é o mesmo ponto de integração que liga os dois (alertas e mensagens).
- **Trava estrutural contra disparo em massa** (Regra de Ouro já existente no CLAUDE.md: "sem disparo em massa, envio individual e consentido"): a tabela é uma linha por mensagem, pra um único destinatário — não existe campo de lista/array de destinatários, nem tela de seleção múltipla. Enviar pra 50 pessoas exige 50 ações deliberadas, não uma.
- **Mensagem pra eleitor (cidadão) é restrita a `coord_campanha`** — mesma regra de sempre (só esse papel lida com PII nominal de cidadão, migration 0006). Mensagem pra apoiador/liderança é liberada também pra `coord_marketing` (mesmo padrão dessas duas tabelas).
- **Leitura:** mensagem pra eleitor só é visível a quem já vê PII de cidadão (`coord_campanha`, `candidato`); mensagem pra apoiador/liderança é visível a todos os papéis internos. Policy condicional por `tipo_destinatario`, não uma trava única pra tabela inteira.
- **Por que precisa de Route Handler, não INSERT direto do cliente:** checar se o provedor está configurado e (quando estiver) chamar a API de envio precisa de segredo de servidor — mesmo motivo do Módulo 4 (sugestão de IA) não ser INSERT direto.
- **Resolução do telefone do destinatário acontece no Route Handler, com a sessão do próprio usuário** (não com service_role) — se a RLS já bloqueia esse papel de ler aquele destinatário (ex.: coord_marketing tentando mandar mensagem "pra cidadão"), o Route Handler nem consegue achar o telefone, então nem tenta enviar. Defesa em profundidade, mesma lógica de `apoiadores.cidadao_id`.

### Modelo de dados (migration 0020)
- `tipo_destinatario_mensagem` ENUM ('cidadao', 'apoiador', 'lideranca').
- `canal_mensagem` ENUM ('whatsapp', 'outro').
- `status_mensagem` ENUM ('pendente_configuracao', 'enviada', 'falhou').
- `mensagens`: id, campanha_id, tipo_destinatario, cidadao_id/apoiador_id/lideranca_id (nullable, CHECK garante exatamente um preenchido de acordo com tipo_destinatario), canal default 'whatsapp', conteudo TEXT NOT NULL, status default 'pendente_configuracao', erro_envio TEXT, enviado_em TIMESTAMPTZ, criado_por, created_at.
- Trigger de defesa em profundidade: destinatário (seja qual for) precisa pertencer à mesma `campanha_id` da mensagem.

### Frontend
- **`/mensagens`:** lista (destinatário — nome se o papel tiver acesso, canal, status com aviso de "WhatsApp não configurado" quando pendente, data) + form "Nova mensagem" (tipo de destinatário, select filtrado, conteúdo, canal). Campo de destinatário "eleitor" só aparece pra `coord_campanha`, mesmo padrão de `/apoiadores`.
- Rota `POST /api/mensagens/enviar`: valida permissão (espelha RLS), resolve telefone do destinatário com a sessão do usuário, tenta enviar (hoje sempre cai em "não configurado"), grava com o status real do resultado.

### Critérios de aceite
- [ ] RLS force-enabled + isolamento cross-tenant testado.
- [ ] Mensagem pra cidadão: só `coord_campanha` cria; `coord_marketing` bloqueado.
- [ ] Mensagem pra apoiador/liderança: `coord_campanha` e `coord_marketing` criam.
- [ ] Leitura de mensagem-pra-cidadão restrita a quem já vê PII de cidadão; mensagem pra apoiador/liderança visível a todos.
- [ ] Destinatário de campanha diferente é rejeitado (trigger).
- [ ] CHECK de coerência tipo↔FK testado (não dá pra criar com tipo 'apoiador' e `cidadao_id` preenchido, etc.).
- [ ] Toda mensagem criada nasce com `status = 'pendente_configuracao'` (sem provedor ainda) — UI não finge que enviou.

### Risco TSE/LGPD
- Baixo pra médio: a trava de "uma linha, um destinatário" impede desvio pro disparo em massa vedado. O maior risco é o mesmo de sempre — vazar PII de cidadão pra papel que não deveria ver —, mitigado pela mesma policy condicional já usada em `apoiadores`.

### Dependências
- **Bloqueante pro envio real:** credencial de provedor de WhatsApp — mesma pendência do Módulo 3.
- Reaproveita `cidadaos`, `apoiadores`, `liderancas`, papéis já existentes.

---

## [2026-07-18] Monitoramento — busca automática de menções (notícias + redes sociais)

- **Gatilho:** usuário pediu pra "cuidar da parte de monitoramento"; a lacuna concreta identificada foi que `monitoramento_itens_update` já existe no banco (migration 0007) mas não tem UI — ficou pra depois. Nesta entrada o usuário pediu especificamente uma busca automática por menções ao candidato, inspirada num reel sobre "IA acha todas as suas fotos na internet" — **recusei replicar isso** (seria busca reversa de imagem/reconhecimento facial, risco de virar ferramenta de vigilância se apontada pra qualquer pessoa) e propus a alternativa: busca por **palavra-chave** (nome do candidato) que só traz candidatos a item pra revisão humana, nunca insere sozinho. Usuário confirmou essa direção.

- **Objetivo:** dar à equipe um atalho pra achar menções ao candidato sem precisar sair procurando manualmente — busca pelo nome do candidato em notícias (Google News, funciona hoje, sem custo/credencial) e em redes sociais (X/Twitter, arquitetura pronta mas **pendente de credencial paga**, mesmo padrão do WhatsApp/Anthropic). Resultado é sempre uma lista de candidatos — a inserção em `monitoramento_itens` continua 100% manual, passando pelo mesmo form e pela mesma RLS de sempre.

### Decisões confirmadas
- Fonte de notícias: Google News RSS público (`news.google.com/rss/search`), sem chave de API — funciona sem nenhuma pendência.
- Fonte de redes sociais: X (Twitter) API v2 recent search — precisa de `TWITTER_BEARER_TOKEN` (plano pago da X); enquanto não configurado, a seção aparece com aviso "não configurado", sem quebrar o resto.
- **Nenhuma tabela nova.** Resultado da busca é efêmero (não persiste no banco) — só existe na resposta da rota e no estado do componente até o usuário clicar em "Usar este item", que pré-preenche o form existente (`MonitoramentoForm`). O usuário ainda escolhe categoria/gravidade e confirma o registro manualmente.
- Busca roda sob demanda (botão "Buscar"), nunca automática/agendada — evita custo de API rodando sem necessidade e mantém o mesmo padrão de "toda chamada externa é uma ação humana explícita" já usado em Mensagens/Alertas.
- Quem pode buscar: mesmos papéis que já podem registrar item (`coord_campanha`, `advogado_responsavel`, `assistente_juridico`, `coord_marketing`, `redator_marketing`) — a rota reaplica essa checagem em código (não é RLS, é uma chamada HTTP externa, não uma escrita no banco).

### Modelo de dados
- **Nenhuma migration.** Reaproveita `monitoramento_itens` e sua RLS existente (0007) — a busca em si não toca o banco além de ler `usuarios_internos.papel` e `campanhas.nome_candidato` pra montar a query, com a sessão do próprio usuário.

### Frontend/backend
- `GET /api/monitoramento/buscar`: Route Handler, sem parâmetro (deriva o nome do candidato da campanha do usuário logado). Busca Google News RSS sempre; busca X só se `TWITTER_BEARER_TOKEN` existir. Retorna `{ noticias, erroNoticias, redes: { configurado, resultados, erro } }`. Erros de rede em qualquer uma das fontes não derrubam a outra.
- `MonitoramentoWorkspace` (client, novo): substitui `MonitoramentoForm` direto na página — segura o estado de "item escolhido pra pré-preencher" e renderiza `BuscaMencoesPanel` (busca + lista de resultados com botão "Usar este item" por linha) acima do form de registro já existente.
- `MonitoramentoForm` ganha props opcionais `prefillUrl`/`prefillDescricao` pra receber o item escolhido — usuário ainda precisa escolher categoria/gravidade e clicar "Registrar", nada é automático.

### Critérios de aceite
- [ ] Busca só funciona pra papel que já pode registrar item (mesmo `PAPEIS_QUE_REGISTRAM` do form) — outros papéis não veem o botão (checagem client-side) nem conseguem chamar a rota direto (checagem server-side na Route Handler).
- [ ] Falha de rede/parse no Google News não quebra a página nem impede o form de registro manual de continuar funcionando.
- [ ] `TWITTER_BEARER_TOKEN` ausente: seção de redes sociais mostra aviso claro, sem erro solto.
- [ ] "Usar este item" preenche url/descrição no form mas **não registra nada sozinho** — só o clique em "Registrar" grava.
- [ ] Nenhuma chamada externa acontece sem o usuário clicar em "Buscar" (sem polling, sem cron).

### Risco TSE/LGPD
- Baixo: a busca só traz o que já é público (notícia indexada, post público) e não persiste nada até confirmação humana — mesmo perfil de risco do cadastro manual que já existia. Evitamos deliberadamente qualquer forma de busca reversa de imagem/reconhecimento facial nesta entrada, por ser desproporcional ao caso de uso e abrir risco de uso indevido contra terceiros (não só o candidato).

### Dependências
- **Bloqueante pra redes sociais:** `TWITTER_BEARER_TOKEN` (credencial paga da X) — notícias funcionam sem nenhuma pendência.

---

## [2026-07-18] Telefone obrigatório em todo cadastro de pessoa

- **Objetivo:** usuário pediu "não permita que ninguém seja cadastrado sem telefone". Levantamento mostrou que `cidadaos.whatsapp` e `apoiadores.telefone` já são `NOT NULL` desde a criação (nenhuma mudança necessária); as lacunas reais são `liderancas.telefone` (nullable no banco e opcional no form) e `usuarios_internos.telefone` (nullable, adicionado depois via ALTER TABLE na migration 0017) — com um caso extremo: **o primeiro usuário da campanha (criado via `bootstrap_campanha` no onboarding) nunca é perguntado o telefone**, o formulário nem tem o campo.
- **Critérios de aceite:**
  - [ ] `liderancas.telefone` e `usuarios_internos.telefone` passam a `NOT NULL`.
  - [ ] `bootstrap_campanha` ganha parâmetro `p_telefone`, valida não-vazio, grava no primeiro `usuarios_internos`.
  - [ ] Convite de usuário (`InviteUserForm`/`POST /api/usuarios/invite`) passa a exigir telefone.
  - [ ] Cadastro de liderança (`LiderancaForm`) passa a exigir telefone.
  - [ ] Dado existente sem telefone (se houver) recebe um placeholder textual óbvio no backfill, não um número inventado — ninguém pode achar que aquele registro tem telefone de verdade.
- **Dados/tabelas afetadas:** `liderancas`, `usuarios_internos`, função `bootstrap_campanha` (migration 0021).
- **Risco TSE/LGPD:** nenhum novo — telefone já era coletado nesses cadastros, só deixa de ser opcional. Mensagens/Alertas já dependiam de telefone existir pra funcionar; isso fecha o buraco que deixava esses dois módulos sem like pra alguns registros.
- **Dependências:** nenhuma.

---

## [2026-07-18] Editar, consultar e desativar cadastros — começando por eleitores

- **Objetivo:** usuário pediu "editar, deletar e consultar" em geral. Auditoria mostrou que nenhuma tela tem edição completa (só toggle de status em apoiador/liderança), busca real só existe em apoiadores/lideranças, e só `tarefas` tem exclusão de verdade — o resto não tem nem policy de DELETE. Pra `cidadaos` e `usuarios_internos` especificamente, apagar de verdade não é desejável nem tecnicamente limpo: cidadão tem `consentimentos_lgpd` (append-only) e usuário interno tem `log_auditoria` (append-only) amarrados — "deletar" vira **desativar** (status), não `DELETE`. Usuário delegou a ordem de execução; comecei por eleitores (lacuna mais grave: nem busca real tinha).
- **Escopo desta entrada:** só `cidadaos` — busca, edição completa (nome/whatsapp/email/território/liderança/círculo) e desativação (status novo). Apoiadores, lideranças e usuários internos ficam para entradas seguintes.
- **Critérios de aceite:**
  - [ ] Busca por nome/whatsapp/bairro-cidade/liderança na lista de eleitores (mesmo padrão client-side já usado em apoiadores/lideranças).
  - [ ] Editar (só coord_campanha, mesma trava de `cidadaos_update_coord`): nome, whatsapp, email, território, liderança, círculo. **Não edita** `origem_cadastro`, `embaixador_coletor_id` (proveniência) nem nada de `consentimentos_lgpd` (registro do que foi assinado, imutável por design).
  - [ ] Desativar/reativar (toggle de `status`), mesmo padrão visual de apoiadores/lideranças — não é DELETE, é UPDATE.
  - [ ] Isolamento de papel: quem só pode ler (`candidato`) não vê botão de editar/desativar, só o status.
- **Dados/tabelas afetadas:** `cidadaos` ganha coluna `status` (migration 0022) — sem policy de RLS nova, reaproveita `cidadaos_update_coord`.
- **Risco TSE/LGPD:** mitiga um risco existente (base sem busca real cresce sem controle) sem criar um novo — nenhum dado de consentimento é tocado, editar campos de contato não altera o que foi assinado no formulário físico.
- **Dependências:** nenhuma.

---

## [2026-07-18] Editar apoiadores e lideranças (continuação da frente de editar/consultar/desativar)

- **Objetivo:** completar a segunda e terceira entidade da frente aberta em "Editar, consultar e desativar cadastros" — apoiadores e lideranças já têm busca e toggle de status, falta a edição completa dos demais campos.
- **Escopo:** edição inline (mesmo padrão de `CidadaoTable`) de nome/telefone/cidade/bairro/território (+ formas de ajuda/detalhe/disponibilidade em apoiadores). **Não edita** `cidadao_id` (vínculo de apoiador com eleitor já tem trigger próprio de quem pode setar — `restringir_vinculo_cidadao_apoiador`, fora de escopo mexer aqui).
- **Dados/tabelas afetadas:** nenhuma migration — `apoiadores_update` e `liderancas_update` já existem e já cobrem qualquer coluna pra quem já gerencia essas telas hoje.
- **Risco TSE/LGPD:** nenhum novo.
- **Dependências:** nenhuma.

---

## [2026-07-18] Editar e revogar acesso de usuários internos — com achado de segurança

- **Objetivo:** última entidade da frente — hoje não existe NENHUMA forma de editar ou revogar acesso de um usuário interno depois do convite. Se alguém sai da equipe, o acesso fica ativo pra sempre.
- **Achado durante o levantamento (relevante, registrado antes de implementar):** `usuarios_internos.status` (enum `ativo`/`revogado`/`expirado`) **já existe desde a migration 0001, mas nunca foi de fato aplicado em lugar nenhum** — as funções `current_papel()`, `current_campanha_id()` e `current_territorio_id()` (usadas em praticamente toda policy de RLS do sistema) fazem `SELECT ... FROM usuarios_internos WHERE id = auth.uid()` **sem filtrar por status**. Ou seja: hoje, marcar alguém como "revogado" não bloquearia nada — a pessoa continuaria com acesso total. Construir só o botão de "revogar" sem corrigir isso seria pior que não ter o botão (falsa sensação de segurança). Corrigindo as 3 funções nesta entrada.
- **Escopo:**
  - Migration: `current_papel()`, `current_campanha_id()`, `current_territorio_id()` passam a exigir `status = 'ativo'` — usuário revogado/expirado some de toda checagem de RLS do sistema (efeito cascata: não lê nem escreve mais nada, em nenhuma tabela).
  - Edição: nome, telefone, papel (recalculando `exige_mfa` a partir do papel novo, mesma regra do convite), território/expiração (só quando papel = embaixador).
  - "Revogar acesso" (status → `revogado`) em vez de excluir — mesmo padrão de desativação das entidades anteriores. Botão de revogar fica desabilitado pra a própria linha do usuário logado (evita autoexclusão acidental).
- **Critérios de aceite:**
  - [ ] Usuário com `status <> 'ativo'` perde acesso de leitura/escrita em qualquer tabela protegida por RLS (testar: revogar um usuário de teste, confirmar por SQL simulando a sessão dele que `current_papel()` retorna NULL).
  - [ ] Edição de papel recalcula `exige_mfa` corretamente.
  - [ ] Usuário não consegue revogar a própria linha pela UI.
- **Dados/tabelas afetadas:** `current_papel()`, `current_campanha_id()`, `current_territorio_id()` (migration nova) — sem mudança de schema, só das 3 funções.
- **Risco TSE/LGPD:** mitiga um risco de segurança real que já existia (controle de acesso incompleto) — não introduz nenhum novo.
- **Dependências:** nenhuma.

---

## [2026-07-18] Reorganização do menu lateral

- **Objetivo:** usuário pediu uma ordem/agrupamento novo pro menu: Administração primeiro, depois Cadastros (Eleitores, Apoiadores, Lideranças), depois o grupo hoje chamado "Análise" vira "Conhecimento" com Base de Conhecimento, Código eleitoral, Concorrentes e Pesquisa (esta última ainda não construída).
- **Decisões confirmadas com o usuário:**
  - Resto do menu (Gestão, Comunicação, e os itens que saem de "Análise": Monitoramento, Dossiê jurídico, Marketing, Peças de conteúdo) fica por minha conta organizar de forma razoável — usuário optou por não detalhar agora.
  - "Código eleitoral" não é página nova — é atalho pro tema "Código eleitoral" já existente dentro da Base de Conhecimento (confirmado: fica dentro do grupo Conhecimento, mecanismo de atalho por âncora era a opção recomendada, sem sinal contrário).
- **Decisão minha (não confirmada explicitamente, documentada por transparência):**
  - Criei dois grupos novos pros itens que saíam de "Análise" sem grupo definido: **Jurídico** (Monitoramento, Dossiê jurídico) e **Marketing** (Marketing, Peças de conteúdo) — separação que já existe conceitualmente nos módulos do projeto (Módulo 3 Jurídico, Módulo 4 Marketing), não é uma escolha arbitrária.
  - "Pesquisa" **não entrou no menu ainda** — link pra página que não existe seria pior que não ter o item. Adiciono assim que a tela existir.
- **Escopo:**
  - `AppShell.tsx`: reordena `NAV_GROUPS` — Administração, Cadastros (nova ordem interna: Eleitores/Apoiadores/Lideranças), Gestão, Comunicação, Jurídico (novo), Marketing (novo), Conhecimento (renomeado de Análise, conteúdo reduzido).
  - `base-conhecimento/page.tsx`: cada tema ganha um `id` de âncora (`tema-<slug do nome>`) — permite o link "Código eleitoral" do menu pular direto pro tema, sem precisar saber o UUID (que é diferente por campanha). Se a campanha não tiver um tema com esse nome, o link só cai no topo da página, sem erro.
- **Dados/tabelas afetadas:** nenhuma — mudança 100% de frontend/navegação.
- **Risco TSE/LGPD:** nenhum.
- **Dependências:** nenhuma.

---

## [2026-07-18] Código Eleitoral compartilhado entre campanhas

- **Objetivo:** usuário notou que já tinha subido manualmente 2 PDFs de legislação eleitoral (Código Eleitoral Anotado do TSE + Lei 4.737/1965) na campanha de teste, via `.pipeline/seed_codigo_eleitoral.sql`, e perguntou se isso poderia já vir pronto no sistema, já que é a mesma lei pra qualquer campanha. Confirmei a abordagem com o usuário antes de implementar.
- **Decisão de arquitetura (primeira exceção deliberada à regra de isolamento por `campanha_id`):** em vez de duplicar um PDF de ~9MB em storage por tenant, os 2 arquivos vivem uma vez só, num prefixo `_global/codigo-eleitoral/` no bucket `base-conhecimento` já existente. As linhas de metadado (`temas_campanha`, `base_conhecimento_itens`, `base_conhecimento_arquivos`) continuam por campanha — só o `arquivo_path` de dentro delas aponta pro arquivo compartilhado. Toda regra de RLS das tabelas continua igual; só a policy de leitura de storage ganha uma exceção pro prefixo `_global` (liberada a qualquer usuário interno ativo, não travada por campanha).
- **Escopo:**
  - Função `seed_codigo_eleitoral(campanha_id)`: cria o tema "Código Eleitoral" + os 2 itens apontando pro arquivo compartilhado, só se a campanha ainda não tiver esse tema (idempotente).
  - `bootstrap_campanha` chama essa função pra toda campanha nova — nasce com o Código Eleitoral já carregado.
  - Backfill pras campanhas que já existem e não têm o tema ainda.
  - A campanha de teste que já tinha feito isso manualmente (com PDFs próprios, per-tenant) **não é afetada** — a função detecta que o tema já existe e não mexe.
- **Critérios de aceite:**
  - [ ] Campanha nova criada via onboarding já nasce com o tema "Código Eleitoral" e os 2 itens.
  - [ ] Qualquer papel interno ativo consegue abrir/baixar os PDFs do prefixo `_global`, de qualquer campanha.
  - [ ] Usuário revogado (migration 0023) não consegue ler nem o conteúdo compartilhado.
  - [ ] Ninguém consegue subir/editar/apagar arquivo no prefixo `_global` pela aplicação (sem policy de INSERT/UPDATE/DELETE — conteúdo mantido pela operação do sistema).
- **Dados/tabelas afetadas:** nova policy de storage (`_global`), função `seed_codigo_eleitoral`, `bootstrap_campanha` (chamada extra, mesma assinatura).
- **Risco TSE/LGPD:** nenhum — conteúdo é lei federal pública, não dado pessoal nem de campanha.
- **Dependências:** os 2 PDFs precisaram ser copiados manualmente pro prefixo `_global` via `supabase storage cp` (fora do SQL — storage não é manipulável por INSERT puro), reaproveitando os arquivos que o usuário já tinha subido na campanha de teste.

---

## [2026-07-18] Auditoria de UX/UI — primeira rodada (fonte, ícone, ícones no app, status)

- **Objetivo:** usuário pediu análise de UX/UI geral e visual mais moderno. Levantamento (ver auditoria completa na conversa) achou: (1) bug real — fonte Geist carregada via `next/font` mas nunca usada, `body` tinha `font-family: Arial` fixo no CSS; (2) zero ícones em todo o sistema; (3) paleta 100% cinza padrão do Tailwind, sem token de marca; (4) favicon/ícones em `public/` ainda eram os genéricos do Next.js; (5) zero estado de carregamento visual; (6) app essencialmente desktop-only (só 3 de 22 páginas usam qualquer classe responsiva). Usuário confirmou seguir a ordem recomendada: primeiro os itens grátis, depois ícones (maior impacto visual, mudança mecânica), decisão sobre mobile fica pra depois.
- **Escopo desta entrada:**
  1. Corrige `globals.css`: `body` passa a usar `var(--font-sans)` (Geist) com Arial como fallback, não mais Arial fixo.
  2. Novo `app/icon.svg` (convenção do Next.js — vira favicon automaticamente): checkmark branco num quadrado arredondado escuro, mesma cor da sidebar. Remove o `favicon.ico` genérico do Next.js e os SVGs de exemplo não usados em `public/` (file/globe/next/vercel/window.svg).
  3. Instala `lucide-react` (biblioteca de ícones leve, tree-shakeable) — primeira dependência de ícones do projeto.
  4. Ícones em: todo item de navegação da sidebar (`AppShell.tsx`), botão "Sair", os 6 cards do dashboard, e um indicador visual (bolinha) nos badges de status (ativo/inativo/revogado) em eleitores, apoiadores, lideranças e usuários internos.
- **Fora desta entrada (decisão explícita de escopo, não esquecido):** ícones em botões de ação individuais (Editar/Excluir por linha), paleta de cor de destaque própria, responsividade mobile — ficam pra rodadas seguintes, cada uma é uma decisão de escopo/design maior que o usuário ainda não confirmou.
- **Dados/tabelas afetadas:** nenhuma — mudança 100% visual/frontend.
- **Risco TSE/LGPD:** nenhum.
- **Dependências:** nenhuma.

---

## [2026-07-19] Auditoria de UX/UI — segunda rodada (ícones de ação, cor de destaque, responsividade mobile)

- **Objetivo:** usuário pediu explicitamente os 3 itens que tinham ficado em aberto na primeira rodada: ícones nos botões de ação, uma cor de destaque, e responsividade mobile de verdade.
- **Decisão de cor — neutra em relação a partido:** escolhi **indigo** (`indigo-600`) como cor de destaque única do sistema. Justificativa registrada: partidos brasileiros têm cores muito fortes e disputadas (vermelho, azul, verde-amarelo já carregam associação partidária forte); indigo/violeta não é cor de nenhuma legenda relevante, e já é comum em SaaS profissional. Aplicado em: botões primários de formulário (todo "Salvar"/"Cadastrar"/"Criar"/"Convidar"/"Adicionar" do sistema — 28 arquivos, mesmo padrão de classe idêntico em todos), item ativo da sidebar, anel de foco de qualquer campo (`globals.css`, regra global — não precisou tocar cada input individualmente).
- **Ícones em botões de ação:** `Pencil` (editar), `Check`/`X` (salvar/cancelar), `Trash2` (excluir), `Plus` (adicionar), `CheckCircle2` (aprovar) — aplicados nas 4 telas principais de cadastro (eleitores/apoiadores/lideranças/usuários), nos botões de excluir de tarefas/metas/base de conhecimento, e no fluxo de aprovação de peças de conteúdo. De quebra, troquei 2 emojis (🗑️ em `TarefaRow`/`MetaDeleteButton`) por ícone de verdade — inconsistente com o resto do sistema, que não usa emoji em lugar nenhum.
- **Responsividade mobile:**
  - `AppShell.tsx`: sidebar vira um drawer off-canvas abaixo do breakpoint `md` — escondida por padrão, abre com botão de hambúrguer no topo, tem overlay escurecido atrás, fecha sozinha ao clicar fora ou ao navegar pra outra página (via `useEffect` no `pathname`). Acima de `md`, comportamento idêntico ao anterior (sidebar sempre visível, sem hambúrguer).
  - Todo grid de formulário de 2 ou 3 colunas (`grid-cols-2`/`grid-cols-3` sem nenhum prefixo responsivo — 32 ocorrências em 20 arquivos) passou a empilhar em 1 coluna abaixo do breakpoint `sm` e só vira grade a partir daí. Antes disso, qualquer formulário de 2-3 campos lado a lado ficava espremido numa tela de celular.
- **Fora desta entrega (não esquecido, escopo deliberadamente cortado por tempo):** ícones em ações secundárias mais profundas (ex.: "remover" de arquivo individual dentro de um item da base de conhecimento); emojis remanescentes em `ApoiadorForm` (⚠️ aviso de doação), `AlertaCard`, `TerritorioForm` (📍), `liderancas/page.tsx` (🎯 metas), `monitoramento/page.tsx` e `dossie-juridico/page.tsx` (🔒 evidência lacrada) — não foram tocados, ficam como próxima rodada se o usuário quiser.
- **Dados/tabelas afetadas:** nenhuma — mudança 100% frontend.
- **Risco TSE/LGPD:** nenhum.
- **Dependências:** nenhuma.

---

## [2026-07-19] Módulo 3 Jurídico — limpeza dos emojis remanescentes

- **Objetivo:** dos 6 arquivos com emoji remanescente listados na auditoria de UX/UI da entrada anterior, tratar aqui só os 3 que pertencem ao bloco Jurídico (usuário pediu explicitamente para continuar por esse módulo, não os 6 de uma vez): `monitoramento/page.tsx` (🔒), `dossie-juridico/page.tsx` (🔒), `alertas/AlertaCard.tsx` (⚠️ x2 — não estava na lista original, achado ao abrir o arquivo — e ✅, achado da mesma forma).
- **Escopo:** troca mecânica de emoji por ícone lucide-react, mesmo padrão já estabelecido no resto do sistema (`size={12}`, `strokeWidth={2}`, `aria-hidden="true"`, dentro de um container `flex items-center gap-1`). Sem mudança de comportamento, cor ou texto.
- **Ícones escolhidos:** `Lock` (evidência lacrada, nas duas telas — mesmo conceito, mesmo ícone), `AlertTriangle` (aviso de WhatsApp não configurado / falha de envio), `CheckCircle2` (confirmação de encaminhamento à Justiça Eleitoral — reaproveita o mesmo ícone já usado em `PecaCard.tsx` para "aprovar", mantendo o significado de "concluído/positivo" consistente entre módulos).
- **Fora desta entrega:** os outros 3 arquivos com emoji (`ApoiadorForm.tsx`, `TerritorioForm.tsx`, `liderancas/page.tsx`) — pertencem a Relacionamento/Marketing, não Jurídico; ficam para quando o usuário pedir por esses módulos.
- **Dados/tabelas afetadas:** nenhuma — mudança 100% frontend.
- **Risco TSE/LGPD:** nenhum.
- **Dependências:** nenhuma.

---

## [2026-07-19] Auditoria de UX/UI — terceira rodada: grafite mais claro na sidebar + chips coloridos no dashboard

- **Objetivo:** usuário achou o visual ainda simples e pediu opinião sobre grafite + azul-marinho pra dar mais modernidade. Recomendei grafite (neutro, sem risco partidário) em vez de azul-marinho puro (associado ao PSDB no imaginário eleitoral brasileiro) — manter indigo como já validado, só aprofundar a base. Montei mockup comparativo (Atual/Proposta) antes de tocar código; usuário aprovou depois de pedir o grafite um pouco mais claro (dois tons).
- **Decisões confirmadas com o usuário:** grafite claro na sidebar (não azul-marinho), manter indigo como único acento (sem mudança), gostou especificamente dos ícones em chip colorido nos cards do dashboard (Alertas, Lideranças, Tarefas etc.).
- **Escopo:**
  1. Sidebar (`AppShell.tsx`): fundo de `neutral-900`/`neutral-800` pra grafite com leve viés frio — `#232830` (fundo), `#3a414d` (borda), `#2c323c` (hover). Implementado com valor arbitrário Tailwind (`bg-[#232830]` etc.) em vez de token customizado em `@theme` — a primeira tentativa via `@theme inline` no `globals.css` não gerou a utilidade sem reiniciar o servidor dev (confirmado via inspeção de `document.styleSheets`, nenhuma regra `.bg-graphite-950` existia); revertido pra manter simples.
  2. Dashboard (`dashboard/page.tsx`): os 6 cards ganham um chip colorido atrás do ícone (`bg-indigo-50 text-indigo-600` na maioria, `bg-amber-50 text-amber-700` só no card "Alertas pendentes" — cor semântica de atenção, não o acento do sistema), cantos maiores (`rounded-xl`) e sombra suave (`shadow-sm shadow-neutral-900/5`) no lugar da borda plana.
- **Fora desta entrega:** ícones em chip nas outras telas de tabela (eleitores/apoiadores/lideranças) — só o dashboard foi pedido/mostrado no mockup; se o usuário gostar do resultado real, extends pra outras telas fica pra rodada seguinte, não assumido aqui.
- **Dados/tabelas afetadas:** nenhuma — mudança 100% frontend.
- **Risco TSE/LGPD:** nenhum. Nota de neutralidade partidária: grafite/indigo mantidos deliberadamente por não terem associação com legenda brasileira relevante (documentado desde a escolha original do indigo); azul-marinho foi descartado exatamente por esse motivo.
- **Dependências:** nenhuma.

---

## [2026-07-19] Reorganização de menu (Demandas, Monitoramento) + novo sistema Respostas (Marketing)

- **Objetivo:** três pedidos do usuário, registrados numa mensagem anterior e agora autorizados a implementar: (1) mover "Demandas" pra dentro do grupo Conhecimento, (2) mover "Monitoramento" pra dentro do grupo Marketing, (3) criar um sistema novo "Respostas" dentro de Marketing — a pessoa cola uma pergunta recebida nas redes sociais e o sistema sugere uma resposta usando o conhecimento já cadastrado na campanha + copywriting/neuromarketing político/persuasão.

### Reorganização de menu (decisão do usuário, não peço confirmação de detalhe)
- `AppShell.tsx` `NAV_GROUPS`: "Demandas" sai de Gestão e entra em Conhecimento (fica: Base de conhecimento, Código eleitoral, Concorrentes, Demandas). "Monitoramento" sai de Jurídico e entra em Marketing. Isso deixa o grupo Jurídico só com "Dossiê jurídico" (grupo de 1 item já existe hoje em Administração/Usuários, não é um problema estrutural). Grupo Marketing fica, em ordem de fluxo de trabalho: Monitoramento (detectar menção/pergunta) → Respostas (responder) → Marketing (planejar conteúdo) → Peças de conteúdo (produzir/aprovar).
- **Nota de desvio de decisão anterior:** `specs.md` [2026-07-18] tinha registrado Monitoramento dentro de Jurídico como decisão minha (não pedida). O usuário agora pediu explicitamente pra mudar — não é engano, é revisão de uma decisão anterior.

### Sistema "Respostas" — decisões de escopo (autonomia técnica concedida pelo usuário, documentada aqui)
1. **Página própria** (`/respostas`, não uma seção dentro de `/marketing`) — mesmo padrão de "Peças de conteúdo" (que também é página própria dentro do grupo Marketing), porque o usuário chamou de "um sistema", não um recurso a mais dentro da página existente.
2. **Reaproveita o padrão de `sugestoes_conteudo`** (Módulo 4): tabela de histórico append-only (sem UPDATE/DELETE — é registro de auditoria de chamada de IA, não conteúdo editável), leitura liberada a todo papel interno ativo da campanha, criação por `coord_campanha`/`coord_marketing`/`redator_marketing` (mesmo conjunto de papéis que já gera sugestão de conteúdo).
3. **Contexto pra IA puxado de verdade da Base de Conhecimento** — em vez de depender só de copy-paste manual (como `sugestoes_conteudo` faz hoje), a rota busca todos os `base_conhecimento_itens` (título+descrição) da campanha do usuário (a mesma consulta que `/marketing` já faz pra alimentar a lista de propostas do `SugestaoForm`) e manda como contexto de fundo pra IA, complementado por um campo opcional "contexto adicional" caso a pessoa queira acrescentar algo pontual que não esteja na base. Isso é o ponto central do pedido ("baseado no conhecimento adquirido no sistema").
4. **Canal de origem reaproveita o enum `canal_peca_conteudo`** já existente (sem migration de tipo novo) — na UI de Respostas só ofereço o subconjunto que faz sentido pra "pergunta recebida em rede social" (instagram, facebook, tiktok, whatsapp, outro — omito rádio/tv/site do formulário, embora o enum completo continue existindo no banco).
5. **Prompt de sistema novo** (`SISTEMA_RESPOSTA_REDES` em `lib/anthropic.ts`), com instrução explícita de copywriting + neuromarketing político + persuasão, mas com as mesmas salvaguardas já usadas em `SISTEMA_SUGESTAO_CONTEUDO`: não inventar fatos/números, não difamar concorrente, nunca fingir ser um eleitor/pessoa real, e deixar claro que é sugestão pra revisão humana antes de postar. **Isto é só uma sugestão de rascunho — o sistema não posta nada sozinho em rede social nenhuma**, mesma régua de "IA sugere, humano publica" já usada em todo o Módulo 4.
6. **Sem rotulagem/aprovação formal tipo `pecas_conteudo`** — é uma ferramenta de rascunho interno (como `sugestoes_conteudo`), não o conteúdo final publicado. Se a pessoa decidir usar a resposta sugerida literalmente como uma peça pública (ex.: responder um comentário publicamente como "post"), essa peça nasceria em `pecas_conteudo` com `usou_ia=true` e seguiria a rotulagem já obrigatória de lá — não duplico essa lógica aqui.

### Modelo de dados (migration 0025)
- `respostas_redes_sociais`: id, campanha_id, pergunta TEXT NOT NULL, canal_origem `canal_peca_conteudo` NOT NULL default 'outro', contexto_adicional TEXT nullable, resposta_sugerida TEXT NOT NULL, modelo_ia TEXT NOT NULL, solicitado_por FK usuarios_internos nullable, created_at.
- RLS: force enabled. SELECT liberado a `campanha_id = current_campanha_id()` (qualquer papel interno ativo — `current_papel()` já exige `status='ativo'` desde a correção da migration 0023). INSERT só `coord_campanha`/`coord_marketing`/`redator_marketing`. Sem policy de UPDATE/DELETE.

### Frontend
- **`/respostas`:** form (pergunta, canal de origem, contexto adicional opcional) + botão "Gerar resposta sugerida" + resultado com aviso "sugestão gerada por IA — revisão humana obrigatória antes de postar" (mesmo texto/padrão do `SugestaoForm`). Histórico de respostas já geradas abaixo (mesma lista simples de `sugestoes_conteudo`/`analises_campanha`).
- Rota `POST /api/marketing/resposta`: valida papel (espelha RLS), busca `base_conhecimento_itens` da campanha via sessão do próprio usuário (RLS já filtra por tenant), monta prompt com pergunta+canal+contexto_adicional+conhecimento, chama Anthropic, grava e retorna.

### Critérios de aceite
- [ ] RLS force-enabled + isolamento cross-tenant testado.
- [ ] `redator_marketing` gera resposta (positivo); `advogado_responsavel`/`assistente_juridico` não conseguem (trigger/policy bloqueia via API — 403).
- [ ] Leitura do histórico liberada a todo papel interno ativo (mesmo padrão de sugestões).
- [ ] Sem `ANTHROPIC_API_KEY` configurada, a rota retorna erro claro (mesmo padrão já usado em `/api/marketing/sugestao`) — não finge que gerou.
- [ ] Menu: Demandas aparece em Conhecimento, Monitoramento aparece em Marketing, ambos navegam pra rota certa (rotas não mudam, só o agrupamento visual).

### Risco TSE/LGPD
- Baixo: é uma ferramenta de rascunho/sugestão interna (mesma régua já usada em `sugestoes_conteudo`/`analises_campanha`) — não publica nada sozinha, não interage com o eleitor, não inventa fatos (restrita ao conhecimento cadastrado + instrução explícita contra invenção). O maior cuidado é o prompt não incentivar desinformação ou ataque a concorrente — mitigado pelas mesmas salvaguardas já usadas no resto do Módulo 4.

### Dependências
- `ANTHROPIC_API_KEY` já configurada (usada por todo o Módulo 4) — sem bloqueio novo.

---

## [2026-07-19] Calendário eleitoral com prazos TSE

- **Objetivo:** dar visibilidade aos prazos do calendário eleitoral 2026 dentro do sistema. Hoje o sistema *trava* a janela de silêncio nas peças de conteúdo, mas nenhuma tela *mostra* os prazos chegando (início da propaganda 16/08, registro de candidatura 15/08, eleição 04/10). Proposto por mim no balanço de produto, aprovado pelo usuário junto com outras 3 specs.

### Decisões do Planejador (registradas, não perguntadas)
1. **Tabela compartilhada entre campanhas** (`prazos_eleitorais`, sem `campanha_id`) — segunda exceção deliberada ao isolamento por tenant, mesmo precedente do Código Eleitoral compartilhado (specs.md 2026-07-18): o calendário é lei federal pública, idêntico pra qualquer campanha. Leitura liberada a qualquer usuário interno ativo; **sem policy de INSERT/UPDATE/DELETE** — conteúdo mantido por migration/seed, exatamente como o Código Eleitoral.
2. **Sem envio de alerta (WhatsApp) nesta entrega** — a matriz de alertas existente é acoplada a `monitoramento_itens` e o WhatsApp segue sem credencial. Aviso é **visual**: banner no dashboard. Integração com alertas fica registrada como evolução futura.
3. **Datas com marcação de origem:** as fixadas pela Lei 9.504/1997 (convenções 20/07–05/08, registro até 15/08, propaganda a partir de 16/08, eleição no 1º domingo de outubro = 04/10, 2º turno no último domingo = 25/10) entram com `fonte = 'Lei 9.504/1997'`. As definidas por resolução anual (prestação de contas parcial, datas de rádio/TV, pesquisas) entram com `fonte = 'Resolução TSE — calendário eleitoral 2026'` e **precisam ser conferidas contra a resolução oficial antes do seed final** — critério de aceite explícito pro Testador.

### Modelo de dados (migration nova)
- `prazos_eleitorais`: id UUID pk, `data` DATE NOT NULL, `titulo` TEXT NOT NULL, `descricao` TEXT, `categoria` TEXT NOT NULL CHECK IN ('convencoes','registro','propaganda','financeiro','votacao','outro'), `fonte` TEXT NOT NULL, created_at. Índice em `data`.
- RLS force-enabled: SELECT pra `authenticated` com `current_papel() IS NOT NULL` (garante usuário interno ativo — mesmo gate do conteúdo `_global`); nenhuma policy de escrita. `REVOKE ALL FROM anon`.
- Seed na própria migration com os prazos de 2026.

### Frontend
- **`/calendario-eleitoral`** (grupo Jurídico do menu, ícone `CalendarClock`): lista agrupada por mês; cada prazo com badge de estado — "passou" (neutro), "próximos 7 dias" (âmbar), "futuro" (indigo) — e contagem de dias restantes. Sem filtro nesta entrega (são ~15-20 linhas, filtro é excesso).
- **Dashboard:** banner "Próximo prazo: [título] — faltam N dias" acima dos cards, âmbar quando N ≤ 7, indigo caso contrário. Nada aparece se não houver prazo futuro.

### Critérios de aceite
- [ ] Qualquer papel interno ativo de qualquer campanha vê os mesmos prazos; usuário revogado não vê nada.
- [ ] Nenhuma rota da aplicação consegue inserir/editar/apagar prazo.
- [ ] Datas de resolução anual conferidas contra a Resolução TSE do calendário 2026 antes do seed ser dado como final.
- [ ] Banner do dashboard mostra o próximo prazo futuro correto e some quando não há nenhum.

### Risco TSE/LGPD
- Nenhum — dado público de lei federal, sem PII. Risco real é **informacional**: data errada no seed induz a campanha a erro de prazo; por isso a conferência contra a resolução oficial é critério de aceite, não sugestão.

### Dependências
- Nenhuma credencial. Migration nova (numeração após a 0027, que ainda aguarda aplicação em staging).

---

## [2026-07-19] Busca global (eleitores, apoiadores, lideranças)

- **Objetivo:** um campo de busca única no topo do app — hoje, achar uma pessoa exige entrar em Eleitores, depois Apoiadores, depois Lideranças e procurar em cada lista. Proposto no balanço de produto, aprovado pelo usuário.

### Decisões do Planejador (registradas, não perguntadas)
1. **Busca server-side via página `/busca?q=`** (server component), não endpoint JSON + dropdown client-side: reaproveita o padrão de página do sistema inteiro, funciona sem JS extra e a RLS da sessão filtra naturalmente — embaixador/papéis restritos só encontram o que as policies já deixam ver, sem lógica nova por papel.
2. **Campos pesquisados** (confirmados no schema real): `cidadaos` (nome, whatsapp, email), `apoiadores` (nome, telefone, bairro), `liderancas` (nome, telefone, bairro). `ILIKE '%q%'` com `%`/`_` escapados; mínimo 2 caracteres; limite 20 resultados por grupo.
3. **Telefone com normalização leve:** se o termo tiver ≥ 4 dígitos, a busca também compara só-dígitos contra as colunas de telefone — acha "+5581 9..." digitando "81 9" ou "819".
4. **Resultado leva à lista do módulo, não a um registro:** as telas atuais são listas com edição in-line, não há página por registro. O resultado mostra os dados essenciais in-line (nome, telefone, bairro/círculo, badge do tipo) + link pro módulo. Deep-link com destaque de linha fica registrado como evolução futura, não bloqueia.

### Frontend
- `AppShell.tsx`: campo de busca no header (entre o nome da campanha e o botão Sair; no mobile, ícone `Search` que expande). Submit navega pra `/busca?q=...` (GET puro).
- **`/busca`**: três seções (Eleitores / Apoiadores / Lideranças) com contagem, resultados in-line e link "ver no módulo". Estado vazio claro ("nada encontrado pra 'x'"). Sem paginação (limite 20 por grupo cobre o caso de uso "achar uma pessoa").

### Dados/tabelas afetadas
- Nenhuma migration. Só leitura via sessão do usuário (chave anon + RLS, como todo o frontend).

### Critérios de aceite
- [ ] Busca por nome parcial, por trecho de telefone (com e sem máscara) e por bairro retorna a pessoa certa no grupo certo.
- [ ] Papel com acesso restrito (ex.: embaixador) só vê resultados que as policies já permitem — verificado com sessão real, não presumido.
- [ ] Termo com `%` ou `_` não quebra nem vira curinga.
- [ ] `q` com menos de 2 caracteres não dispara consulta.

### Risco TSE/LGPD
- Médio-baixo: a busca expõe PII **já acessível** nas listas dos módulos — não abre dado novo, a RLS continua sendo o guarda. Atenção do Programador: nunca logar o termo de busca com resultados em lugar nenhum (evitar trilha de "quem procurou quem" fora do necessário).

### Dependências
- Nenhuma.

---

## [2026-07-19] Dashboard evolutivo (painel executivo)

- **Objetivo:** o dashboard hoje é 6 contagens estáticas. Com dados que já existem, passar a responder "a campanha está crescendo?": evolução semanal de cadastros, temperatura da base, funil e cobertura por território. É também a primeira entrega que dá ao papel `candidato` uma visão executiva de verdade. Proposto no balanço, aprovado pelo usuário.

### Decisões do Planejador (registradas, não perguntadas)
1. **Sem biblioteca de gráfico** — barras em divs/SVG puro com Tailwind. Coerente com a decisão de stack ("sem framework de UI pesado") e suficiente pra barras semanais e de distribuição. Se um dia precisar de linha/série complexa, a decisão de lib é tomada aí.
2. **Sem RPC/função SQL nova** — as agregações são feitas no server component a partir de selects enxutos (`created_at` das últimas 8 semanas; `circulo`; `estagio`; `territorio_id`). Em escala de campanha (milhares de linhas) isso é barato; se crescer, migrar pra RPC agregada é otimização futura documentada.
3. **RLS decide o que cada papel vê** — mesmo padrão do dashboard atual: papel sem SELECT numa tabela vê aquela seção vazia/zerada, sem lógica por papel na tela.

### Seções novas (abaixo dos 6 cards atuais)
1. **Crescimento semanal** — barras das últimas 8 semanas de novos eleitores, apoiadores e lideranças (`created_at`), com total da semana corrente destacado.
2. **Temperatura da base** — barra segmentada por `circulo` (frio/morno/quente) dos eleitores, com contagem e %.
3. **Funil de conversão** — contagens por `estagio` (estagio_funil) dos eleitores + razão eleitores → apoiadores → lideranças.
4. **Cobertura por território** — top 5 territórios por nº de eleitores; onde `votos_disponiveis_estimados > 0`, mostra % de cobertura (eleitores/estimativa). Territórios sem estimativa mostram só a contagem.

### Dados/tabelas afetadas
- Nenhuma migration — só leitura.

### Critérios de aceite
- [ ] Números das seções batem com contagens SQL diretas nas mesmas janelas de tempo (verificação real do Testador, não visual).
- [ ] Sessão de `candidato` renderiza o painel sem erro (agregados que a RLS permitir; seções sem acesso aparecem vazias, não quebradas).
- [ ] Semana sem cadastro aparece como barra zero, não some do eixo.
- [ ] Mobile: seções empilham em 1 coluna sem overflow horizontal.

### Risco TSE/LGPD
- Baixo: só agregados, nenhum dado nominal novo exposto. Candidato segue sem acesso a PII bruta — esta tela reforça o desenho original (candidato vê agregado, não lista).

### Dependências
- Nenhuma.

---

## [2026-07-19] Agenda de campanha (eventos territoriais)

- **Objetivo:** registrar e acompanhar os atos de campanha — caminhadas, reuniões, comícios, carreatas, entrevistas, agendas internas — com data, território, lideranças envolvidas e presença. Era o "módulo de apoio: agenda territorial" previsto desde a definição de escopo (specs.md 2026-07-13) sem dono; entra agora como a maior lacuna funcional apontada no balanço, aprovado pelo usuário.

### Decisões do Planejador (registradas, não perguntadas)
1. **Edição restrita a `coord_campanha`; leitura pra todos os papéis internos** — agenda é operação central da coordenação. Ampliar edição (ex.: coord_marketing) é mudança de uma linha de policy se o usuário pedir; começo restrito, que é o reversível.
2. **Vínculo de pessoas só com lideranças** (tabela de junção com presença) — não com eleitores/apoiadores nominais: presença de eleitor em evento é dado sensível de opinião política que o sistema não precisa guardar (LGPD art. 5º II); público geral entra como `publico_estimado` numérico no evento realizado.
3. **Lista, não grade de calendário** — MVP é lista agrupada por dia (próximos primeiro), que resolve "o que temos essa semana". Visão mensal em grade fica registrada como evolução.
4. **Aviso TSE de pré-propaganda, sem bloqueio:** evento de rua (caminhada/comício/carreata) com data antes de 16/08/2026 mostra aviso "antes do início da propaganda eleitoral (16/08) — confirme o enquadramento legal do ato". Não bloqueia: reunião interna e agenda de contato são lícitas antes; quem responde pelo enquadramento é humano. Showmício é vedado em qualquer data (Lei 9.504 art. 39 §7º) — nota no formulário quando tipo = comício.

### Modelo de dados (migration nova, dupla enum+tabela no padrão 0014/0015)
- Enums: `tipo_evento_campanha` ('caminhada','reuniao','comicio','carreata','entrevista','agenda_interna','outro'); `status_evento_campanha` ('planejado','confirmado','realizado','cancelado').
- `eventos_campanha`: id, campanha_id NOT NULL FK, titulo TEXT NOT NULL, tipo NOT NULL, status NOT NULL default 'planejado', data_inicio TIMESTAMPTZ NOT NULL, data_fim TIMESTAMPTZ nullable CHECK (data_fim > data_inicio), territorio_id nullable FK, local_texto TEXT, descricao TEXT, publico_estimado INTEGER nullable CHECK (>= 0), criado_por FK usuarios_internos, created_at. Índice (campanha_id, data_inicio).
- `eventos_liderancas`: evento_id FK ON DELETE CASCADE, lideranca_id FK ON DELETE CASCADE, compareceu BOOLEAN nullable (null = ainda não marcado), PK composta.
- RLS force-enabled nas duas: SELECT `campanha_id = current_campanha_id()` (na junção, via join com eventos da campanha); INSERT/UPDATE/DELETE só `coord_campanha`. Grants correspondentes; revoke de anon.

### Frontend
- **`/agenda`** no grupo Gestão (ícone `CalendarDays`), entre Tarefas e Mapa: lista agrupada por dia com badge de tipo e status; filtros por status e território; form de criar/editar (título, tipo, data/hora início e fim, território, local, descrição, lideranças vinculadas); ação "marcar como realizado" que abre público estimado + presença das lideranças vinculadas.
- Eventos passados não realizados ficam com destaque âmbar ("pendente de atualização") — agenda que ninguém atualiza vira lixo silencioso; o destaque é o empurrão.

### Critérios de aceite
- [ ] Isolamento cross-tenant testado nas duas tabelas (sessões de campanhas diferentes).
- [ ] Papel não-coordenação lê a agenda mas não cria/edita/apaga (403/erro de policy, verificado com sessão real).
- [ ] Vincular lideranças, marcar realizado com presença e público estimado funciona ponta a ponta.
- [ ] Aviso de pré-propaganda aparece pra evento de rua antes de 16/08 e não aparece pra reunião interna.
- [ ] Mobile: lista e formulário empilham sem overflow.

### Risco TSE/LGPD
- TSE: o sistema **registra** atos, não os legitima — avisos de pré-propaganda e showmício são lembretes, a responsabilidade legal é da campanha (mesma régua "sistema informa, humano decide" dos módulos de IA).
- LGPD: nenhum dado nominal de eleitor vinculado a evento (decisão 2 acima) — só lideranças já cadastradas e número agregado de público.

### Dependências
- Nenhuma credencial. Migration nova na sequência (após 0027 e o calendário eleitoral, conforme ordem de implementação).
