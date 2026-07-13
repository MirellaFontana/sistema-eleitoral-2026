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
