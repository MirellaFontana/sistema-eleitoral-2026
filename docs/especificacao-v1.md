# Plataforma eleitoral 2026 — especificação de sistema

**Versão:** 1.0 (planejamento pré-desenvolvimento)
**Contexto:** Eleições Gerais 2026 — 1º turno em 04/10/2026. Propaganda liberada a partir de 16/08/2026.
**Carteira-alvo:** deputado estadual e federal (volume), senador e governador (alto valor).
**Marco regulatório:** Lei 9.504/1997 (arts. 57-A a 57-J), Resolução TSE 23.610/2019 com alterações da Resolução 23.755/2026, LGPD.

---

## 1. Tese do produto

Não são sete ferramentas. É **uma plataforma** com um núcleo de dados único (o CRM do Cidadão) e módulos que plugam nele. Duas frentes:

- **Proteção jurídica** — reduz o risco de multa e cassação. Comprador: o **advogado eleitoral** e o coordenador de campanha. É venda por medo, ciclo curto, alta conversão.
- **Relacionamento** — constrói vínculo com o eleitor e atravessa a eleição. Comprador: o **candidato e a coordenação**. É venda por ambição, e é o que gera receita recorrente pós-outubro.

O diferencial competitivo não está em nenhum módulo isolado — está no núcleo compartilhado. A enquete alimenta o CRM; o CRM alimenta o loop de demanda; o loop de demanda vira histórico de mandato. O concorrente que copiar um módulo não copia o efeito composto.

---

## 2. Arquitetura em camadas

### Camada 1 — captação
- App/PWA do cidadão (enquete, envio de demanda, acompanhamento)
- App do embaixador (coleta em campo, funciona offline)
- Coletores externos (monitoramento de redes e web, dados abertos do TSE, IBGE, portais legislativos)
- Ingestão de peças de comunicação produzidas pela campanha (para rotulagem e auditoria)

### Camada 2 — núcleo de dados (CRM do Cidadão)
Coração do sistema. Multi-tenant, com **isolamento rígido por campanha** (dado de um candidato jamais cruza com o de outro — isso é risco jurídico e comercial, não só técnico).

Responsabilidades:
- Cadastro de pessoas com **registro de consentimento** (base legal, finalidade, timestamp, origem, texto aceito)
- Geolocalização até o nível de bairro/seção eleitoral
- Trilha de auditoria imutável (append-only) de tudo que entra e sai
- Motor de segmentação (por território, tema de interesse, tipo de vínculo)

### Camada 3 — módulos

**Bloco proteção jurídica**
1. **Conformidade e rotulagem IA** — cada peça registrada com ferramenta usada, prompt, responsável, aprovação; rotulagem obrigatória aplicada; bloqueio automático da janela de 72h antes / 24h depois; dossiê de defesa exportável.
2. **Escudo antideepfake** — monitora, detecta conteúdo fabricado contra o candidato, arquiva com carimbo de data/hora (prova de existência mesmo após remoção), monta o dossiê técnico.
3. **Matriz de alertas** — configurável por destinatário / gravidade / canal. **Encaminhamento formal à Justiça Eleitoral trava sempre no advogado.**

**Bloco relacionamento**
4. **Enquete e plano de governo** — escuta estruturada que gera insumo de proposta + contato consentido no CRM + narrativa de campanha ("meu plano nasceu de X mil respostas").
5. **Loop de demanda legislativa** — cidadão relata; mandato/candidatura encaminha na moeda certa: emenda destinada, requerimento protocolado, projeto de lei, cobrança de órgão. Devolve a comprovação ao cidadão. **Não é "resolvo seu buraco"** — é intermediação e representação.
6. **Rede de embaixadores** — recruta, equipa e reconhece líderes locais. Sem pagamento, sem premiação econômica (vedado).
7. **Histórico de mandato** — ativo pós-eleição e peça de campanha para incumbentes.

**Módulos de apoio (fase 2)**
- Motor de agenda territorial (onde ir amanhã — cruza histórico eleitoral por seção + censo + campo)
- Simulador de quociente eleitoral (ferramenta de venda + planejamento de meta de votos)

### Camada 4 — saída
- Painel do advogado (alertas, dossiês, status de conformidade)
- Painel da coordenação (agenda, território, embaixadores, pipeline de demandas)
- Painel do candidato (visão executiva, uma tela)
- App do cidadão (retorno da demanda, transparência)

---

## 3. Modelo de dados (entidades centrais)

| Entidade | Campos-chave | Observação |
|---|---|---|
| `campanha` | id, cargo, uf, partido, plano contratado | Raiz do isolamento multi-tenant |
| `usuario_interno` | id, campanha_id, papel (advogado / coord. comunicação / coord. campanha / candidato / embaixador) | Papel dirige permissão e alertas |
| `cidadao` | id, campanha_id, nome, contato, geo (municipio, bairro, seção), temas de interesse | Nunca compartilhado entre campanhas |
| `consentimento` | id, cidadao_id, finalidade, base_legal, texto_aceito, timestamp, canal, status | Imutável. Revogação cria novo registro, não apaga o anterior |
| `demanda` | id, cidadao_id, tema, geo, descrição, status, tipo_encaminhamento, comprovante | Status: recebida → triada → encaminhada → respondida |
| `encaminhamento` | id, demanda_id, tipo (emenda / requerimento / ofício / PL), nº, órgão, data, evidência | É a prova de entrega |
| `peca_conteudo` | id, campanha_id, tipo, usou_ia, ferramenta, prompt, rotulo_aplicado, aprovador, publicado_em, canal | Alimenta o dossiê de defesa |
| `evento_ameaca` | id, campanha_id, tipo (deepfake / desinformação / ataque), url, captura, hash, gravidade, detectado_em | Base do escudo |
| `alerta` | id, evento_id, destinatarios[], canal, enviado_em, lido_em, acao_tomada | Roteamento configurável |
| `resposta_enquete` | id, cidadao_id, enquete_id, respostas, geo | Insumo de plano + entrada no CRM |
| `embaixador` | id, cidadao_id, territorio, nivel_atividade, materiais_recebidos | Sem campo de pagamento — por design |
| `log_auditoria` | id, campanha_id, ator, ação, entidade, antes, depois, timestamp | Append-only, sem update nem delete |

---

## 3.1 Como o dado entra (decisão de arquitetura)

Existem três níveis de cadastro, e eles são diferentes por natureza:

**Nível 1 — setup da campanha (raiz).** Campanha, candidato, cargo, partido, UF, plano contratado. Feito uma vez, no onboarding. É a raiz do isolamento multi-tenant.

**Nível 2 — setup da estrutura interna.** Usuários e papéis, temas de atuação, territórios, matriz de alertas. Cadastrado pela coordenação.

**Nível 3 — entrada de cidadãos. NUNCA por digitação da campanha.**

O cidadão entra **exclusivamente por consentimento próprio**, por um destes canais:
- respondendo a enquete
- enviando uma demanda
- se cadastrando no app
- sendo cadastrado por embaixador em campo, **com o aceite capturado no aparelho, no momento, com o cidadão presente**

Não existe importação de lista. Não existe cadastro em massa. Não existe "pular o consentimento".

**Por quê:** a diferença entre um CRM valioso e um passivo jurídico está exatamente aqui. Base sem origem rastreável não pode ser usada, não vale nada comercialmente e vira risco de LGPD para o cliente e para a agência. Base com consentimento registrado (finalidade, texto aceito, timestamp, origem, canal) é o ativo que estamos vendendo.

**Coleta do embaixador — requisitos:**
- Funciona offline, sincroniza depois
- Texto do aceite exibido na tela antes do registro
- Captura: timestamp, geolocalização, identificação do embaixador coletor
- Sem aceite, o cadastro não completa
- Origem rastreável até o embaixador (impede que alguém "importe a agenda do celular" para inflar número)

---

## 3.2 Controle de acesso por papel

**Decisão:** papéis **fixos** no MVP. Customização de permissões fica para versão futura — flexibilidade demais no v1 gera campanha configurando errado e culpando a agência.

Princípio: cada papel vê o mínimo necessário para o seu trabalho.

| Papel | Acesso | Não acessa |
|---|---|---|
| **Embaixador** | Cadastra e vê **apenas o próprio território**. Coleta demanda e enquete. | Base completa, dados de outros embaixadores, qualquer exportação |
| **Advogado** | Bloco jurídico completo: ameaças, dossiês, peças, trilha de auditoria. **Único com botão de encaminhamento formal.** | Base nominal de cidadãos (não é necessário ao trabalho dele) |
| **Coord. de comunicação** | Alertas de ameaça, peças de conteúdo, status de rotulagem | Dado pessoal de cidadão |
| **Coord. de campanha** | Visão operacional ampla: base, território, demandas, embaixadores | — (conta mais sensível: MFA obrigatório) |
| **Candidato** | Painel executivo: números, temas, entregas | Dado pessoal bruto |

**Três requisitos que fazem o controle valer alguma coisa:**

1. **Log de acesso** — toda visualização e exportação de dado pessoal é registrada (quem, o quê, quando). Sem isso, o controle de acesso é decorativo.
2. **Exportação é permissão separada** — ver a base e baixar a base são poderes distintos. Exportação restrita a 1-2 pessoas, com log e aprovação. É por exportação que base vaza.
3. **Revogação imediata + expiração automática** — um clique revoga acesso. O acesso do embaixador expira automaticamente no fim do ciclo, sem depender de alguém lembrar.

**Racional do caso do embaixador:** é voluntário, tem alta rotatividade e às vezes migra para a campanha adversária no meio do caminho. Se ele tem acesso à base inteira, ele leva a base inteira embora.

---

## 4. Stack sugerida

| Camada | Escolha | Por quê |
|---|---|---|
| Backend | Python (FastAPI) ou Node (NestJS) | Ecossistema de IA maduro; time provavelmente já domina |
| Banco | PostgreSQL + PostGIS | Geo é requisito central (seção, bairro, território) |
| Fila / assíncrono | Redis + worker (Celery/BullMQ) | Monitoramento e alertas precisam ser assíncronos |
| Armazenamento de evidência | Object storage com versionamento + WORM | Prova jurídica exige imutabilidade |
| Front web | React | Painéis internos |
| App | PWA (fase 1) → nativo se necessário | PWA reduz custo e acelera; embaixador precisa de modo offline |
| Orquestração de IA | Camada de abstração multi-modelo | Não amarrar num fornecedor; permite trocar modelo por custo/qualidade |
| Auth | OIDC + MFA obrigatório para advogado e candidato | Conta comprometida em campanha é catástrofe |

---

## 5. Onde a IA entra (e onde ela não pode entrar)

**IA no sistema — usos legítimos:**
- Triagem e classificação de demandas por tema e urgência
- Detecção e classificação de ameaças (conteúdo suspeito de manipulação)
- Sumarização de respostas de enquete em eixos de proposta
- Priorização de agenda territorial
- Rascunho de peças (sempre com rotulagem obrigatória e revisão humana)

**Trava crítica de compliance:** a Resolução 23.755/2026 veda que provedores de sistemas de IA **ranqueiem, recomendem, sugiram ou priorizem candidatos** ao eleitorado, ou emitam opinião/preferência eleitoral, inclusive por resposta automatizada. Consequência de design: **nenhum componente de IA voltado ao cidadão pode recomendar voto ou candidato.** O chatbot do app do cidadão é informativo e de registro de demanda — nunca persuasivo-automatizado. IA que orienta *a campanha* (interna) é livre; IA que fala *com o eleitor* é fortemente restrita.

**Deepfake:** vedação absoluta, sem salvaguarda de rotulagem. O sistema nunca gera conteúdo sintético de voz ou imagem de pessoa real. Isso deve ser bloqueio técnico, não política escrita.

---

## 6. Guardrails legais embutidos no produto

Cada um destes vira uma regra de código, não um aviso no rodapé:

1. **Rotulagem automática** de todo conteúdo gerado ou significativamente alterado por IA — explícita, destacada e acessível; em áudio, no início da peça.
2. **Bloqueio de janela** — impede publicação de novo conteúdo sintético de 72h antes até 24h depois do pleito. Trava de sistema, não lembrete.
3. **Bloqueio de impulsionamento inválido** — só o formato permitido: contratado direto com plataforma habilitada, pelo candidato/partido, com CNPJ/CPF e a expressão "Propaganda Eleitoral", registrado em prestação de contas. **Banner pago em site de terceiro é bloqueado pelo sistema.**
4. **Bloqueio de impulsionamento negativo** — o módulo alerta se a peça a ser impulsionada ataca adversário (vedado, com multa, mesmo se verdadeiro).
5. **Sem disparo em massa** em WhatsApp/Telegram; envio individual e consentido, com opt-in e opt-out visíveis.
6. **Sem pagamento a embaixador** — não existe campo de remuneração nem mecanismo de premiação com vantagem econômica. Por design.
7. **LGPD** — consentimento granular, finalidade explícita, direito de revogação, portabilidade, expurgo programado.
8. **Encaminhamento à Justiça travado no advogado.**

---

## 7. Faseamento (o relógio é o problema)

Estamos em **julho**. Propaganda começa em **16 de agosto**. Eleição em **4 de outubro**. A janela de venda está fechando — o faseamento tem que respeitar isso.

**Fase 0 — vender agora (2 semanas, sem código pesado)**
- Simulador de quociente eleitoral (ferramenta leve, é a isca comercial — o candidato entende na hora por que precisa de você)
- One-pager e deck de cada produto
- Serviço de conformidade em modo consultivo (processo + planilha + advogado parceiro), enquanto a plataforma não existe

**Fase 1 — MVP para o ciclo 2026 (até meados de agosto)**
- Núcleo CRM + consentimento + geo
- Módulo de conformidade e rotulagem + trilha de auditoria
- Escudo antideepfake (detecção + dossiê + matriz de alertas)
- Enquete + captação de contato consentido
- App do embaixador (offline first)

**Fase 2 — durante a campanha (agosto a outubro)**
- Loop de demanda legislativa
- Agenda territorial
- Painel do candidato

**Fase 3 — pós-eleição (a partir de novembro — é aqui que a receita recorrente nasce)**
- Histórico e transparência de mandato
- Gestão de mandato (o CRM de campanha vira CRM de gabinete)
- Migração do cliente de "campanha" para "assinatura anual"

Realismo: entregar tudo antes de 16 de agosto não é factível. A decisão estratégica é **priorizar o bloco de proteção jurídica para 2026** (é o que tem urgência, medo e orçamento) e usar o bloco de relacionamento como o produto que se aprofunda ao longo do ciclo e se consolida no mandato.

---

## 8. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Prazo — não dá pra construir tudo até agosto | Alta | Fase 0 vende o que já existe; MVP enxuto no bloco jurídico |
| Interpretação errada da norma vira multa do cliente | Alta | Advogado eleitoral como revisor formal de cada regra do sistema; nada de "achismo" no código |
| Vazamento de base de eleitores | Alta | Isolamento por tenant, criptografia, MFA, log de acesso. Um vazamento mata a empresa |
| Falso positivo do escudo gera ação temerária | Média | Ferramenta nunca aciona sozinha — advogado decide |
| Fadiga de alerta | Média | Filtro por gravidade, resumo diário para ruído |
| Viés da enquete (só responde quem já é da base) | Média | Deixar explícito que é escuta direcional, não pesquisa representativa; ponderar por região |

---

## 9. Decisões em aberto

- **Modelo comercial:** licença por campanha, SaaS mensal, ou fee + sucesso? (Recomendação: setup + mensalidade durante a campanha + assinatura de mandato pós-eleição)
- **Advogado eleitoral parceiro:** contratar como revisor do produto ou como canal de venda? Ele é ao mesmo tempo o comprador e o validador — vale desenhar essa relação com cuidado.
- **Construir tudo ou comprar peças?** Monitoramento de redes tem fornecedor pronto — talvez não valha construir do zero num prazo desses.
- **Escopo de 2026 vs. produto de longo prazo:** o que é gambiarra aceitável pra atender esse ciclo e o que precisa nascer certo?

---

## 10. Próximo passo recomendado

1. Fechar o modelo comercial e o preço por faixa de cargo.
2. Contratar/parcear com advogado eleitoral **antes** de escrever a primeira linha de código de compliance.
3. Construir o simulador de quociente esta semana — é o que abre a porta dos candidatos enquanto o resto é desenvolvido.
4. Cortar escopo do MVP até caber até 16 de agosto. Se não couber, cortar de novo.

---

*Documento de planejamento. As interpretações da legislação eleitoral aqui descritas devem ser validadas por advogado eleitoral antes de virarem regra de produto ou promessa comercial.*
