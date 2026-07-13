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
