# Sistema Eleitoral 2026 — CLAUDE.md

## O que é este projeto

Plataforma SaaS **multitenant** para campanhas eleitorais (Eleições Gerais 2026 — 1º turno 04/10/2026, propaganda liberada a partir de 16/08/2026). Núcleo de dados único (CRM do Cidadão) com dois blocos de módulos: **proteção jurídica** (compliance TSE, antideepfake, alertas) e **relacionamento** (enquetes, demandas, embaixadores, mandato).

Especificação completa de arquitetura, entidades e faseamento: [docs/especificacao-v1.md](docs/especificacao-v1.md). Este arquivo é a fonte de verdade de produto — leia antes de propor mudanças de escopo.

## Arquitetura multitenant

- Cada **campanha** (candidato) é um tenant isolado. `campanha_id` é a raiz de isolamento de todo o schema.
- Persistência e isolamento via **Supabase** (Postgres + Row Level Security). Nenhuma tabela que carregue dado de cidadão, demanda, peça de conteúdo ou log pode ser acessada sem filtro de `campanha_id` — isso é garantido por RLS no banco, não apenas por filtro na aplicação.
- Dado de uma campanha **nunca** cruza com o de outra. Isso é simultaneamente risco jurídico (LGPD, sigilo de estratégia de campanha) e risco comercial (cliente concorrente vendo dado do outro mata a empresa).
- Toda tabela sensível tem trilha de auditoria **append-only** (sem update/delete) — ver `log_auditoria` na especificação.

## Stack

Postgres + PostGIS (geo é requisito central) via Supabase, fila assíncrona (Redis/worker) para monitoramento e alertas, armazenamento de evidência com versionamento (WORM), front React, app do embaixador em PWA offline-first.

## Onde a IA pode e não pode atuar (guardrail de produto, não só de código)

- IA **interna** (triagem de demanda, detecção de ameaça, sumarização de enquete, rascunho de peça) é livre, sempre com revisão humana.
- IA **voltada ao cidadão** nunca pode recomendar voto, candidato, ranquear ou emitir preferência eleitoral (Resolução TSE 23.755/2026). Chatbot do cidadão é informativo/registro de demanda, nunca persuasivo-automatizado.
- Deepfake: vedação absoluta. Bloqueio técnico, não política escrita — o sistema nunca gera conteúdo sintético de voz ou imagem de pessoa real.

## Pipeline de trabalho (`.pipeline/`)

Fluxo dos 4 agentes especializados:

1. **Planejador** escreve a spec da tarefa em [.pipeline/specs.md](.pipeline/specs.md) antes de qualquer código.
2. **Programador** implementa e registra o que fez em [.pipeline/changes.md](.pipeline/changes.md).
3. **Testador** verifica e registra o resultado em [.pipeline/results.md](.pipeline/results.md).
4. **Revisor** audita os três documentos + o diff antes de considerar a tarefa fechada.

## Estilo de trabalho (fluxo otimizado para TDAH)

- Passos curtos. Uma tarefa por vez, visível, com critério de "pronto" claro antes de passar para a próxima.
- Respostas diretas, sem enrolação, sem hedging desnecessário — direto ao ponto (equivalente ao que seria uma skill "Caveman").
- Código enxuto e eficiente: preferir a solução mais simples que resolve o problema, evitar abstração prematura, evitar excesso de comentários — economiza tokens e reduz custo de revisão (equivalente ao que seria uma skill "Ponytail").
- Pensar antes de codar: todo item passa por `.pipeline/specs.md` antes de virar código — disciplina de dev sênior, não "codar de cabeça quente" (equivalente ao que seria uma skill "SuperPowers").
- Boas práticas de Supabase (RLS por tenant, políticas explícitas por papel, migrations versionadas, nunca client-side bypass de RLS) valem como padrão obrigatório para o Módulo 1 e todos os seguintes.

> Nota: as quatro habilidades acima ("SuperPowers", "Ponytail", "Caveman", "Supabase Best Practices") não existem como skills instaláveis neste ambiente Claude Code — o comportamento equivalente está codificado diretamente nas regras acima.

## Regras de Ouro de 25 anos

1. **Todo conteúdo gerado por IA deve ter o rótulo obrigatório de "conteúdo sintético"** (Resolução TSE 23.732/2024). Isso é regra de produto (aplicada em código, bloqueando publicação sem rótulo), não aviso de rodapé.
2. **O foco inicial é o Módulo 1 (Cadastros)**, com segmentação de eleitores por **Círculos (Quente, Morno, Frio)** e por **Território**. Nenhum outro módulo entra em desenvolvimento antes do Módulo 1 estar sólido — isolamento multitenant, consentimento e segmentação são a fundação de tudo o resto.

## Papéis e controle de acesso (MVP)

Papéis fixos: Embaixador (só o próprio território), Advogado (bloco jurídico completo, único com botão de encaminhamento formal à Justiça Eleitoral), Coord. de comunicação (alertas + peças), Coord. de campanha (visão operacional ampla, MFA obrigatório), Candidato (painel executivo). Ver seção 3.2 da especificação para o detalhe de cada papel.

## Cadastro de cidadão — regra inegociável

Cidadão **nunca** entra por digitação da campanha ou importação de lista. Entra exclusivamente por consentimento próprio (enquete, demanda, app, ou embaixador em campo com aceite capturado no aparelho, no momento, com o cidadão presente). Ver seção 3.1 da especificação.
