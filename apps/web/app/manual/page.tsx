import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manual do Usuário — Eleito Online",
  description: "Guia completo de uso da plataforma de gestão eleitoral inteligente",
};

function Toc() {
  const secoes = [
    { id: "intro", label: "1. Introdução" },
    { id: "acesso", label: "2. Acesso ao Sistema" },
    { id: "sala-decisao", label: "3. Sala de Decisão" },
    { id: "estrategia", label: "4. Estratégia" },
    { id: "administracao", label: "5. Administração" },
    { id: "cadastros", label: "6. Cadastros" },
    { id: "gestao", label: "7. Gestão" },
    { id: "comunicacao", label: "8. Comunicação" },
    { id: "juridico", label: "9. Jurídico" },
    { id: "inteligencia", label: "10. Inteligência" },
    { id: "marketing", label: "11. Marketing" },
    { id: "dicas", label: "12. Dicas e Boas Práticas" },
  ];
  return (
    <nav className="mb-12 rounded-xl border border-indigo-100 bg-indigo-50/60 p-6 print:border-neutral-200 print:bg-white">
      <h2 className="mb-3 text-lg font-bold text-indigo-900">Sumário</h2>
      <ol className="columns-2 gap-x-8 space-y-1 text-sm">
        {secoes.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="text-indigo-700 underline decoration-indigo-300 hover:text-indigo-900 print:text-black print:no-underline">
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 mt-14 scroll-mt-6 border-b-2 border-indigo-600 pb-2 text-2xl font-bold text-indigo-900 print:text-black print:border-black first:mt-0">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-8 text-lg font-semibold text-slate-800">{children}</h3>;
}

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white print:bg-black">
        {n}
      </span>
      <div className="text-sm leading-relaxed text-slate-700 pt-0.5">{children}</div>
    </div>
  );
}

function Dica({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:border-amber-600 print:bg-white">
      <strong>Dica:</strong> {children}
    </div>
  );
}

function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-lg border-l-4 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900 print:border-red-600 print:bg-white">
      <strong>Importante:</strong> {children}
    </div>
  );
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-indigo-200 bg-indigo-50/50">
            {cabecalho.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-semibold text-indigo-900">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-neutral-100 even:bg-neutral-50/50">
              {l.map((c, j) => (
                <td key={j} className="px-3 py-2 text-slate-700">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ManualPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8 print:max-w-none print:px-0 print:py-0">
      {/* Capa */}
      <div className="mb-12 text-center">
        <img src="/logo.png" alt="Eleito Online" className="mx-auto mb-6 h-auto w-72" />
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">Manual do Usuário</h1>
        <p className="mt-2 text-lg text-slate-500">Plataforma Eleito Online — Gestão Eleitoral Inteligente</p>
        <p className="mt-1 text-sm text-slate-400">Versão 1.0 — Agosto 2026</p>
      </div>

      <Toc />

      {/* 1. Introdução */}
      <H2 id="intro">1. Introdução</H2>
      <p className="mb-4 text-sm leading-relaxed text-slate-700">
        O <strong>Eleito Online</strong> é uma plataforma completa de gestão de campanhas eleitorais brasileiras.
        Ela reúne em um único sistema: cadastro de eleitores, apoiadores e lideranças; gestão de tarefas e agenda;
        comunicação com a equipe; inteligência de monitoramento de notícias e concorrentes; consultoria jurídica
        eleitoral com IA; criação de peças de marketing com revisão de compliance; e planejamento de impulsionamento
        de anúncios.
      </p>
      <p className="mb-4 text-sm leading-relaxed text-slate-700">
        O sistema utiliza <strong>inteligência artificial</strong> em diversas funcionalidades: geração de briefings
        diários, análise de narrativas, recomendações estratégicas, sugestão de respostas para cidadãos, revisão
        jurídica de peças publicitárias, geração de imagens e planos de impulsionamento.
      </p>

      <H3>Papéis do sistema</H3>
      <Tabela
        cabecalho={["Papel", "Descrição", "Acesso principal"]}
        linhas={[
          ["Coordenador de Campanha", "Administrador geral da campanha", "Acesso total a todas as funcionalidades"],
          ["Candidato", "O candidato da campanha", "Visualização de briefings, decisões e recomendações"],
          ["Coordenador de Marketing", "Responsável pelo marketing", "Marketing, peças, impulsionamento, comunicação"],
          ["Redator de Marketing", "Criação de conteúdo", "Peças de conteúdo, marketing, comunicação"],
          ["Advogado Responsável", "Jurídico da campanha", "Módulo jurídico, revisão de peças, compliance"],
          ["Assistente Jurídico", "Apoio jurídico", "Consultas jurídicas, dossiê"],
          ["Coordenador de Campo", "Gestão de campo", "Cadastros, campo, demandas, mapa"],
          ["Agente de Campo", "Trabalho de campo", "Registro de eventos, escuta de campo"],
          ["Tesoureiro", "Finanças da campanha", "Visualização geral, auditoria"],
          ["Assessor de Comunicação", "Comunicação institucional", "Mensagens, avisos, monitoramento"],
          ["Analista de Dados", "Análise estratégica", "Inteligência, monitoramento, propostas, narrativas"],
        ]}
      />

      {/* 2. Acesso ao Sistema */}
      <H2 id="acesso">2. Acesso ao Sistema</H2>

      <H3>2.1 Primeiro acesso (convite)</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        O acesso ao sistema é feito exclusivamente por <strong>convite</strong>. O coordenador de campanha
        envia um convite por e-mail através do módulo de Usuários.
      </p>
      <Passo n={1}>Você receberá um e-mail com o assunto &quot;Convite — Gestão Eleitoral&quot;.</Passo>
      <Passo n={2}>Clique no link do e-mail. Você será redirecionado para a tela de definição de senha.</Passo>
      <Passo n={3}>Defina uma senha com no mínimo 8 caracteres.</Passo>
      <Passo n={4}>Após definir a senha, você será redirecionado para o sistema já autenticado.</Passo>

      <H3>2.2 Login</H3>
      <Passo n={1}>Acesse <strong>eleito.online</strong> no navegador.</Passo>
      <Passo n={2}>Na tela de login, preencha seu <strong>e-mail</strong> e <strong>senha</strong>.</Passo>
      <Passo n={3}>Clique em <strong>&quot;Entrar&quot;</strong>.</Passo>
      <Passo n={4}>Você será redirecionado para a <strong>Sala de Decisão</strong> (tela inicial).</Passo>
      <Dica>O sistema funciona em celulares e tablets. Use o menu hambúrguer (☰) no canto superior esquerdo para abrir a navegação em telas pequenas.</Dica>

      <H3>2.3 Esqueci minha senha</H3>
      <Passo n={1}>Na tela de login, clique em <strong>&quot;Esqueci minha senha&quot;</strong>.</Passo>
      <Passo n={2}>Digite o e-mail cadastrado e clique em <strong>&quot;Enviar link&quot;</strong>.</Passo>
      <Passo n={3}>Verifique sua caixa de entrada (e spam). Você receberá um e-mail com o link de redefinição.</Passo>
      <Passo n={4}>Clique no link e defina a nova senha (mínimo 8 caracteres).</Passo>
      <Alerta>O link de redefinição é enviado apenas para e-mails já cadastrados no sistema. Se você não recebeu o e-mail, confirme com o coordenador se seu e-mail está correto.</Alerta>

      <H3>2.4 Navegação</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        O sistema possui uma <strong>barra lateral</strong> (sidebar) escura à esquerda com todos os módulos
        organizados em grupos. Clique no nome do grupo para expandir/recolher os itens. O item ativo fica
        destacado em verde. No topo da página, há uma <strong>barra de busca</strong> para localizar pessoas
        rapidamente, um <strong>sino de notificações</strong> e o botão de <strong>sair</strong>.
      </p>

      {/* 3. Sala de Decisão */}
      <H2 id="sala-decisao">3. Sala de Decisão</H2>
      <p className="mb-4 text-sm leading-relaxed text-slate-700">
        A Sala de Decisão é a <strong>tela inicial</strong> do sistema. Ela apresenta um painel com quatro
        quadrantes que resumem o estado atual da campanha:
      </p>
      <Tabela
        cabecalho={["Quadrante", "O que mostra"]}
        linhas={[
          ["Decisões pendentes", "Lista de decisões estratégicas aguardando posicionamento do candidato ou coordenador"],
          ["Recomendações recentes", "Últimas recomendações geradas pela IA com base nos dados da campanha"],
          ["Alertas ativos", "Alertas de monitoramento que exigem atenção (menções negativas, prazos, etc.)"],
          ["Briefing do dia", "Resumo diário gerado por IA com os principais pontos da campanha"],
        ]}
      />
      <Passo n={1}>Ao entrar no sistema, a Sala de Decisão carrega automaticamente.</Passo>
      <Passo n={2}>Clique em qualquer item para ir direto ao módulo correspondente.</Passo>
      <Passo n={3}>O briefing diário é gerado automaticamente pela IA. Clique em <strong>&quot;Gerar briefing&quot;</strong> se quiser um novo.</Passo>
      <Dica>Volte à Sala de Decisão a qualquer momento clicando em &quot;Sala de Decisão&quot; no menu lateral.</Dica>

      {/* 4. Estratégia */}
      <H2 id="estrategia">4. Estratégia</H2>

      <H3>4.1 Decisões</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        O módulo de Decisões permite registrar, acompanhar e decidir sobre questões estratégicas da campanha.
        Cada decisão tem um status (pendente, aprovada, rejeitada) e pode incluir argumentos a favor e contra.
      </p>
      <Passo n={1}>No menu lateral, clique em <strong>Estratégia → Decisões</strong>.</Passo>
      <Passo n={2}>Você verá a lista de decisões com status, data e responsável.</Passo>
      <Passo n={3}>Para criar uma nova decisão, clique no botão <strong>&quot;Nova decisão&quot;</strong>.</Passo>
      <Passo n={4}>Preencha o título, descrição, contexto e argumentos. Clique em <strong>&quot;Salvar&quot;</strong>.</Passo>
      <Passo n={5}>Para aprovar ou rejeitar, abra a decisão e use os botões de ação correspondentes.</Passo>

      <H3>4.2 Recomendações</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        A IA analisa os dados da campanha (monitoramento, base de conhecimento, diretrizes) e gera
        <strong> recomendações estratégicas</strong> com ações concretas. Cada recomendação passa por um ciclo:
        gerada → em análise → aceita/rejeitada → implementada.
      </p>
      <Passo n={1}>Acesse <strong>Estratégia → Recomendações</strong>.</Passo>
      <Passo n={2}>Clique em <strong>&quot;Gerar recomendações&quot;</strong> para a IA criar novas sugestões.</Passo>
      <Passo n={3}>Revise cada recomendação. Você pode <strong>aceitar</strong>, <strong>rejeitar</strong> ou deixar <strong>em análise</strong>.</Passo>
      <Passo n={4}>Recomendações aceitas podem ser marcadas como <strong>implementadas</strong> quando a ação for executada.</Passo>
      <Dica>As recomendações são mais relevantes quando a Base de Conhecimento e as Diretrizes estão bem preenchidas.</Dica>

      {/* 5. Administração */}
      <H2 id="administracao">5. Administração</H2>

      <H3>5.1 Cadastro de Campanha</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Tela central para configurar os dados da campanha: nome do candidato, nome de urna, número,
        cargo, UF, partido, coligação e CNPJ. Também é onde se gerenciam as <strong>chaves de API</strong>
        dos serviços de IA (Anthropic, Google Gemini, OpenAI, Grok).
      </p>
      <Passo n={1}>Acesse <strong>Administração → Cadastro de campanha</strong>.</Passo>
      <Passo n={2}>Preencha ou atualize os dados da campanha nos campos disponíveis.</Passo>
      <Passo n={3}>Na seção <strong>&quot;Chaves de API&quot;</strong>, cadastre as chaves dos provedores de IA que a campanha utiliza.</Passo>
      <Passo n={4}>Clique em <strong>&quot;Salvar&quot;</strong> para gravar as alterações.</Passo>
      <Alerta>As chaves de API são armazenadas de forma criptografada. Nunca compartilhe suas chaves com terceiros.</Alerta>

      <H3>5.2 Usuários</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Gerencie quem tem acesso à campanha. Apenas o <strong>Coordenador de Campanha</strong> pode convidar
        novos usuários e alterar papéis.
      </p>
      <Passo n={1}>Acesse <strong>Administração → Usuários</strong>.</Passo>
      <Passo n={2}>Você verá a lista de usuários com nome, e-mail, papel e status.</Passo>
      <Passo n={3}>Para convidar, preencha o e-mail, selecione o <strong>papel</strong> e clique em <strong>&quot;Convidar&quot;</strong>.</Passo>
      <Passo n={4}>O convidado receberá um e-mail com link para definir a senha e acessar o sistema.</Passo>
      <Passo n={5}>Para alterar o papel de um usuário existente, clique no papel atual e selecione o novo.</Passo>
      <Dica>Cada usuário pode pertencer a apenas uma campanha por vez. Para trocar de campanha, é necessário novo convite.</Dica>

      <H3>5.3 Funções e Permissões</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Visualize a matriz de permissões do sistema: quais papéis têm acesso a quais funcionalidades.
        A criação de funções customizadas é feita nesta tela.
      </p>
      <Passo n={1}>Acesse <strong>Administração → Funções e permissões</strong>.</Passo>
      <Passo n={2}>Visualize a tabela com papéis nas linhas e funcionalidades nas colunas.</Passo>
      <Passo n={3}>Para criar uma nova função, clique em <strong>&quot;Nova função&quot;</strong>, defina nome e permissões.</Passo>

      <H3>5.4 Trilha de Auditoria</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Registro cronológico de todas as ações importantes realizadas no sistema (quem fez o quê e quando).
        Útil para rastreabilidade e conformidade legal.
      </p>
      <Passo n={1}>Acesse <strong>Administração → Trilha de auditoria</strong>.</Passo>
      <Passo n={2}>Use os filtros de data, usuário e tipo de ação para encontrar registros específicos.</Passo>
      <Passo n={3}>Cada entrada mostra: data/hora, usuário, ação realizada e detalhes.</Passo>

      <H3>5.5 Quarentena de Dados</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Quando dados pessoais são solicitados para exclusão (LGPD), eles vão para quarentena antes da remoção
        definitiva. Isso permite revisão e recuperação dentro do prazo legal.
      </p>
      <Passo n={1}>Acesse <strong>Administração → Quarentena de dados</strong>.</Passo>
      <Passo n={2}>Visualize os registros em quarentena com data de entrada e prazo de exclusão.</Passo>
      <Passo n={3}>Para restaurar um registro antes do prazo, clique em <strong>&quot;Restaurar&quot;</strong>.</Passo>

      <H3>5.6 Retenção de Dados</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Configure por quanto tempo cada tipo de dado é mantido no sistema antes da exclusão automática,
        em conformidade com a LGPD e a legislação eleitoral.
      </p>
      <Passo n={1}>Acesse <strong>Administração → Retenção de dados</strong>.</Passo>
      <Passo n={2}>Defina o prazo de retenção para cada categoria de dados.</Passo>
      <Passo n={3}>Clique em <strong>&quot;Salvar&quot;</strong> para aplicar as configurações.</Passo>

      {/* 6. Cadastros */}
      <H2 id="cadastros">6. Cadastros</H2>

      <H3>6.1 Eleitores</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Cadastro central de eleitores. Permite buscar, filtrar, cadastrar e visualizar os detalhes de cada
        eleitor, incluindo dados pessoais, endereço, contato e histórico de interações.
      </p>
      <Passo n={1}>Acesse <strong>Cadastros → Eleitores</strong>.</Passo>
      <Passo n={2}>Use a barra de busca para encontrar um eleitor pelo nome, e-mail ou telefone.</Passo>
      <Passo n={3}>Para cadastrar um novo eleitor, clique em <strong>&quot;Novo eleitor&quot;</strong> e preencha os campos.</Passo>
      <Passo n={4}>Clique no nome de um eleitor para ver seus detalhes e histórico completo.</Passo>
      <Dica>A busca global no topo da página também encontra eleitores. Digite pelo menos 2 caracteres.</Dica>

      <H3>6.2 Apoiadores</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Eleitores que declararam apoio à campanha. Além dos dados básicos, o perfil do apoiador inclui
        nível de engajamento, habilidades, disponibilidade e área de atuação.
      </p>
      <Passo n={1}>Acesse <strong>Cadastros → Apoiadores</strong>.</Passo>
      <Passo n={2}>Visualize a lista com nome, bairro, nível de engajamento e status.</Passo>
      <Passo n={3}>Para promover um eleitor a apoiador, vá ao perfil do eleitor e clique em <strong>&quot;Tornar apoiador&quot;</strong>.</Passo>
      <Passo n={4}>Para registrar atividades do apoiador, abra o perfil e use a seção de histórico.</Passo>

      <H3>6.3 Lideranças</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Líderes comunitários e figuras de influência na região. O cadastro inclui área de influência,
        bairros de atuação, estimativa de votos influenciáveis e vinculação com apoiadores.
      </p>
      <Passo n={1}>Acesse <strong>Cadastros → Lideranças</strong>.</Passo>
      <Passo n={2}>Cada liderança mostra: nome, região de influência, apoiadores vinculados e estimativa de alcance.</Passo>
      <Passo n={3}>Para cadastrar, clique em <strong>&quot;Nova liderança&quot;</strong> e preencha os dados.</Passo>
      <Passo n={4}>Vincule apoiadores existentes à liderança para mapear a rede de influência.</Passo>

      {/* 7. Gestão */}
      <H2 id="gestao">7. Gestão</H2>

      <H3>7.1 Tarefas</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Gerenciamento de tarefas da campanha em formato de lista. Cada tarefa tem título, descrição,
        responsável, prazo, prioridade e status (pendente, em andamento, concluída).
      </p>
      <Passo n={1}>Acesse <strong>Gestão → Tarefas</strong>.</Passo>
      <Passo n={2}>Veja a lista de tarefas com filtros por status, responsável e prioridade.</Passo>
      <Passo n={3}>Clique em <strong>&quot;Nova tarefa&quot;</strong> para criar. Preencha título, descrição, responsável e prazo.</Passo>
      <Passo n={4}>Para atualizar o status, clique na tarefa e altere o campo de status.</Passo>
      <Passo n={5}>Tarefas concluídas ficam com indicação visual de &quot;done&quot;.</Passo>

      <H3>7.2 Agenda</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Calendário de compromissos da campanha. Visualize eventos por dia, semana ou mês. Inclui
        comícios, reuniões, entrevistas, prazos legais e outros compromissos.
      </p>
      <Passo n={1}>Acesse <strong>Gestão → Agenda</strong>.</Passo>
      <Passo n={2}>Navegue pelo calendário usando as setas ou alternando entre visões (dia/semana/mês).</Passo>
      <Passo n={3}>Clique em um dia para criar um novo evento. Preencha título, horário, local e descrição.</Passo>
      <Passo n={4}>Eventos aparecem no calendário com cores indicando o tipo.</Passo>

      <H3>7.3 Escuta de Campo</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Registro de informações coletadas em campo pelos agentes: sentimento dos eleitores, demandas
        da comunidade, percepções sobre a campanha e concorrentes. Cada registro inclui bairro,
        tema, sentimento (positivo/neutro/negativo) e observações.
      </p>
      <Passo n={1}>Acesse <strong>Gestão → Escuta de campo</strong>.</Passo>
      <Passo n={2}>Veja a lista de registros de campo com data, bairro, tema e sentimento.</Passo>
      <Passo n={3}>Clique em <strong>&quot;Novo registro&quot;</strong> para adicionar uma escuta.</Passo>
      <Passo n={4}>Preencha o bairro, tema observado, sentimento e observações detalhadas.</Passo>
      <Dica>Os registros de campo alimentam as recomendações da IA. Quanto mais dados, melhores as sugestões.</Dica>

      <H3>7.4 Demandas</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Registro e acompanhamento de demandas observadas nos bairros e comunidades. Cada demanda
        tem tema, localização, urgência e status de acompanhamento.
      </p>
      <Passo n={1}>Acesse <strong>Gestão → Demandas</strong>.</Passo>
      <Passo n={2}>Visualize as demandas com filtros por bairro, tema e status.</Passo>
      <Passo n={3}>Registre uma nova demanda com localização, tema e descrição detalhada.</Passo>
      <Passo n={4}>Atualize o status conforme a demanda for sendo acompanhada.</Passo>

      <H3>7.5 Mapa</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Visualização geográfica dos dados da campanha em um mapa interativo. Mostra a distribuição
        de eleitores, apoiadores, lideranças, eventos e demandas por região.
      </p>
      <Passo n={1}>Acesse <strong>Gestão → Mapa</strong>.</Passo>
      <Passo n={2}>O mapa carrega centralizado na região da campanha.</Passo>
      <Passo n={3}>Use os filtros para escolher o que exibir: eleitores, apoiadores, lideranças, eventos.</Passo>
      <Passo n={4}>Clique nos marcadores para ver detalhes do ponto.</Passo>
      <Passo n={5}>Use o zoom e arraste para navegar pelo mapa.</Passo>

      {/* 8. Comunicação */}
      <H2 id="comunicacao">8. Comunicação</H2>

      <H3>8.1 Mensagens</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Envio de mensagens para eleitores e apoiadores. Permite criar mensagens individuais ou em massa,
        usando modelos pré-definidos ou texto livre. Inclui histórico de envios.
      </p>
      <Passo n={1}>Acesse <strong>Comunicação → Mensagens</strong>.</Passo>
      <Passo n={2}>Selecione os destinatários (individual, por bairro, por tag ou todos os apoiadores).</Passo>
      <Passo n={3}>Escolha um <strong>modelo de mensagem</strong> ou escreva o texto manualmente.</Passo>
      <Passo n={4}>Revise a mensagem e clique em <strong>&quot;Enviar&quot;</strong>.</Passo>
      <Alerta>Mensagens em massa devem respeitar a legislação eleitoral. O sistema não envia mensagens via WhatsApp automaticamente — ele gera o conteúdo para que a equipe distribua manualmente.</Alerta>

      <H3>8.2 Modelos de Mensagem</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Biblioteca de modelos reutilizáveis para padronizar a comunicação da campanha. Os modelos
        podem conter variáveis (nome do eleitor, bairro, etc.) que são preenchidas automaticamente.
      </p>
      <Passo n={1}>Acesse <strong>Comunicação → Modelos de mensagem</strong>.</Passo>
      <Passo n={2}>Veja os modelos existentes organizados por categoria.</Passo>
      <Passo n={3}>Clique em <strong>&quot;Novo modelo&quot;</strong> para criar. Use {`{nome}`} para variáveis dinâmicas.</Passo>
      <Passo n={4}>Para editar um modelo existente, clique nele e altere o conteúdo.</Passo>

      <H3>8.3 Avisos Internos</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Comunicação interna da equipe de campanha. Avisos são notificações enviadas para todos os
        membros ou para papéis específicos.
      </p>
      <Passo n={1}>Acesse <strong>Comunicação → Avisos internos</strong>.</Passo>
      <Passo n={2}>Veja o mural de avisos com data, autor e destinatários.</Passo>
      <Passo n={3}>Clique em <strong>&quot;Novo aviso&quot;</strong>, escreva o conteúdo e selecione os destinatários.</Passo>

      <H3>8.4 Respostas</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Módulo de <strong>sugestão de respostas por IA</strong> para atender cidadãos. Cole a mensagem
        recebida de um eleitor e a IA gera uma sugestão de resposta alinhada com as diretrizes
        e propostas da campanha.
      </p>
      <Passo n={1}>Acesse <strong>Comunicação → Respostas</strong>.</Passo>
      <Passo n={2}>Cole a mensagem do cidadão no campo de texto.</Passo>
      <Passo n={3}>Clique em <strong>&quot;Gerar resposta&quot;</strong>. A IA analisará a mensagem e sugerirá uma resposta.</Passo>
      <Passo n={4}>Revise, edite se necessário, e copie a resposta para enviar ao cidadão.</Passo>
      <Dica>A qualidade das respostas depende das Diretrizes e Base de Conhecimento cadastradas. Quanto mais completas, mais alinhadas serão as respostas.</Dica>

      {/* 9. Jurídico */}
      <H2 id="juridico">9. Jurídico</H2>

      <H3>9.1 Tira-dúvidas Jurídico</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Consulte a <strong>legislação eleitoral brasileira</strong> usando IA. O sistema tem o Código
        Eleitoral, resoluções do TSE e jurisprudência na base de conhecimento, e responde perguntas
        em linguagem acessível.
      </p>
      <Passo n={1}>Acesse <strong>Jurídico → Tira-dúvidas</strong>.</Passo>
      <Passo n={2}>Digite sua pergunta jurídica no campo de texto. Exemplos: &quot;Pode fazer comício depois das 22h?&quot;, &quot;Quais são os limites de gasto para deputado estadual?&quot;</Passo>
      <Passo n={3}>Clique em <strong>&quot;Consultar&quot;</strong>. A IA responderá citando a base legal aplicável.</Passo>
      <Passo n={4}>O histórico de consultas fica salvo para referência futura.</Passo>
      <Alerta>As respostas da IA são orientativas. Para decisões jurídicas formais, consulte sempre o advogado responsável pela campanha.</Alerta>

      <H3>9.2 Dossiê Jurídico</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Repositório de documentos e anotações jurídicas da campanha. Organize processos, pareceres,
        notificações e outros documentos jurídicos relevantes.
      </p>
      <Passo n={1}>Acesse <strong>Jurídico → Dossiê jurídico</strong>.</Passo>
      <Passo n={2}>Visualize os documentos organizados por tipo e data.</Passo>
      <Passo n={3}>Adicione novos documentos ou anotações clicando em <strong>&quot;Novo registro&quot;</strong>.</Passo>

      <H3>9.3 Calendário Eleitoral</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Linha do tempo com todos os <strong>prazos e datas importantes</strong> do calendário eleitoral
        oficial do TSE para 2026. Inclui prazos de registro de candidatura, início e fim de propaganda,
        datas de debates, votação, etc.
      </p>
      <Passo n={1}>Acesse <strong>Jurídico → Calendário eleitoral</strong>.</Passo>
      <Passo n={2}>Visualize os prazos em formato de linha do tempo.</Passo>
      <Passo n={3}>Datas passadas ficam esmaecidas. Datas futuras próximas ficam destacadas.</Passo>
      <Dica>Os prazos do calendário eleitoral também aparecem nos alertas da Sala de Decisão quando estão próximos.</Dica>

      {/* 10. Inteligência */}
      <H2 id="inteligencia">10. Inteligência</H2>

      <H3>10.1 Diretrizes da Campanha</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Defina as <strong>diretrizes estratégicas</strong> que orientam toda a comunicação e IA da campanha:
        tom de voz, posicionamentos, o que dizer e o que evitar, temas prioritários. As diretrizes são
        injetadas em todos os prompts de IA do sistema.
      </p>
      <Passo n={1}>Acesse <strong>Inteligência → Diretrizes da Campanha</strong>.</Passo>
      <Passo n={2}>Preencha as seções: <strong>Tom de voz</strong>, <strong>Posicionamentos</strong>, <strong>Temas a evitar</strong>, <strong>Público-alvo</strong>.</Passo>
      <Passo n={3}>Cada diretriz pode ser <strong>aprovada</strong> pelo coordenador para entrar em vigor.</Passo>
      <Passo n={4}>Diretrizes aprovadas influenciam todas as respostas e sugestões da IA.</Passo>
      <Alerta>Diretrizes bem definidas são fundamentais para a qualidade da IA. Dedique tempo para preenchê-las com cuidado.</Alerta>

      <H3>10.2 Monitoramento</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Monitore <strong>notícias e menções</strong> sobre a campanha, candidato e concorrentes na internet.
        O sistema busca automaticamente em fontes de notícias e analisa o sentimento de cada menção usando IA.
      </p>
      <Passo n={1}>Acesse <strong>Inteligência → Monitoramento</strong>.</Passo>
      <Passo n={2}>Veja as notícias mais recentes com indicação de sentimento (positivo/neutro/negativo).</Passo>
      <Passo n={3}>Use os filtros para buscar por período, fonte, tema ou sentimento.</Passo>
      <Passo n={4}>Clique em uma notícia para ver o resumo da IA e o link para a fonte original.</Passo>
      <Passo n={5}>Notícias relevantes podem gerar <strong>alertas</strong> automáticos.</Passo>

      <H3>10.3 Registrar Denúncia</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Registre denúncias de irregularidades eleitorais observadas por agentes de campo ou recebidas
        por cidadãos. O sistema organiza as denúncias com evidências e encaminhamento.
      </p>
      <Passo n={1}>Acesse <strong>Inteligência → Registrar denúncia</strong>.</Passo>
      <Passo n={2}>Preencha os campos: tipo de irregularidade, local, data/hora, descrição detalhada.</Passo>
      <Passo n={3}>Anexe evidências (fotos, vídeos, documentos) se disponíveis.</Passo>
      <Passo n={4}>Clique em <strong>&quot;Registrar&quot;</strong>. A denúncia ficará disponível no dossiê jurídico.</Passo>

      <H3>10.4 Alertas</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Central de alertas do sistema. Alertas são gerados automaticamente a partir do monitoramento
        de notícias, prazos do calendário eleitoral e outros eventos que exigem atenção.
      </p>
      <Passo n={1}>Acesse <strong>Inteligência → Alertas</strong>.</Passo>
      <Passo n={2}>Visualize os alertas ativos, ordenados por prioridade.</Passo>
      <Passo n={3}>Clique em um alerta para ver os detalhes e tomar ação.</Passo>
      <Passo n={4}>Marque como <strong>&quot;resolvido&quot;</strong> após tratar o alerta.</Passo>

      <H3>10.5 Saúde das Fontes</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Painel de status das fontes de monitoramento. Mostra se cada fonte de notícias está operacional,
        quando foi a última coleta bem-sucedida e se há falhas recentes.
      </p>
      <Passo n={1}>Acesse <strong>Inteligência → Saúde das fontes</strong>.</Passo>
      <Passo n={2}>Veja o status de cada fonte: operacional (verde), degradada (amarelo) ou offline (vermelho).</Passo>
      <Passo n={3}>Fontes com problemas exibem o motivo da falha e sugestão de correção.</Passo>

      <H3>10.6 Concorrentes</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Cadastre e acompanhe os concorrentes da campanha. Para cada concorrente, registre nome, partido,
        pontos fortes, pontos fracos e acompanhe as menções no monitoramento.
      </p>
      <Passo n={1}>Acesse <strong>Inteligência → Concorrentes</strong>.</Passo>
      <Passo n={2}>Veja a lista de concorrentes cadastrados com resumo de menções.</Passo>
      <Passo n={3}>Clique em <strong>&quot;Novo concorrente&quot;</strong> para cadastrar.</Passo>
      <Passo n={4}>No perfil do concorrente, veja o histórico de menções filtrado automaticamente pelo monitoramento.</Passo>

      <H3>10.7 Base de Conhecimento</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Repositório de conhecimento da campanha organizado por <strong>temas</strong>. Cada tema pode ter
        itens (textos, dados, argumentos), públicos-alvo específicos e regiões prioritárias. A base
        alimenta todas as respostas da IA.
      </p>
      <Passo n={1}>Acesse <strong>Inteligência → Base de conhecimento</strong>.</Passo>
      <Passo n={2}>Visualize os temas cadastrados (ex: Saúde, Educação, Segurança).</Passo>
      <Passo n={3}>Clique em um tema para ver e editar seus itens, públicos-alvo e regiões.</Passo>
      <Passo n={4}>Para criar um novo tema, clique em <strong>&quot;Novo tema&quot;</strong>.</Passo>
      <Passo n={5}>Adicione itens ao tema com título e descrição detalhada.</Passo>
      <Dica>A Base de Conhecimento é o coração da IA. Quanto mais completa e atualizada, melhores serão os briefings, recomendações e respostas geradas.</Dica>

      <H3>10.8 Propostas</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Cadastro das propostas de governo do candidato. Cada proposta tem título, descrição, tema
        vinculado, público beneficiado e status (rascunho, aprovada, publicada).
      </p>
      <Passo n={1}>Acesse <strong>Inteligência → Propostas</strong>.</Passo>
      <Passo n={2}>Veja a lista de propostas com tema, status e resumo.</Passo>
      <Passo n={3}>Clique em <strong>&quot;Nova proposta&quot;</strong> para cadastrar.</Passo>
      <Passo n={4}>Vincule a proposta a um tema da Base de Conhecimento para melhor integração com a IA.</Passo>

      <H3>10.9 Narrativas</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Análise de <strong>narrativas</strong> em circulação sobre temas eleitorais. A IA identifica
        narrativas dominantes a partir do monitoramento de notícias e sugere contra-narrativas
        alinhadas com a campanha.
      </p>
      <Passo n={1}>Acesse <strong>Inteligência → Narrativas</strong>.</Passo>
      <Passo n={2}>Veja as narrativas identificadas com análise de sentimento e alcance.</Passo>
      <Passo n={3}>Clique em <strong>&quot;Analisar narrativas&quot;</strong> para a IA gerar uma nova análise.</Passo>
      <Passo n={4}>Para cada narrativa negativa, a IA sugere pontos de contra-argumentação.</Passo>

      <H3>10.10 Código Eleitoral</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Consulta à <strong>base normativa eleitoral</strong> integrada ao sistema. Inclui o Código
        Eleitoral, Lei das Eleições, resoluções do TSE e normas relacionadas. Permite busca por
        artigo, tema ou palavra-chave.
      </p>
      <Passo n={1}>Acesse <strong>Inteligência → Código eleitoral</strong>.</Passo>
      <Passo n={2}>Use a busca para encontrar artigos específicos ou temas (ex: &quot;propaganda antecipada&quot;).</Passo>
      <Passo n={3}>Navegue pelos capítulos e seções da legislação.</Passo>

      {/* 11. Marketing */}
      <H2 id="marketing">11. Marketing</H2>

      <H3>11.1 Marketing (Hub)</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Página central de marketing com acesso rápido às funcionalidades: criação de conteúdo com IA,
        adaptação de mensagens para diferentes canais, sugestão de público, geração de imagens e
        avaliação de peças existentes.
      </p>
      <Passo n={1}>Acesse <strong>Marketing → Marketing</strong>.</Passo>
      <Passo n={2}>Escolha a funcionalidade desejada: <strong>Gerar conteúdo</strong>, <strong>Adaptar mensagem</strong>, <strong>Gerar imagem</strong> ou <strong>Avaliar peça</strong>.</Passo>

      <p className="mt-4 mb-2 text-sm font-semibold text-slate-800">Gerar conteúdo com IA:</p>
      <Passo n={1}>Descreva o que você precisa (ex: &quot;post para Instagram sobre educação&quot;).</Passo>
      <Passo n={2}>Selecione o canal (Instagram, Facebook, WhatsApp, Twitter).</Passo>
      <Passo n={3}>A IA gera o conteúdo alinhado com as diretrizes e base de conhecimento da campanha.</Passo>
      <Passo n={4}>Revise, edite e salve como peça de conteúdo.</Passo>

      <p className="mt-4 mb-2 text-sm font-semibold text-slate-800">Adaptar mensagem:</p>
      <Passo n={1}>Cole uma mensagem existente que deseja adaptar.</Passo>
      <Passo n={2}>Selecione o canal de destino (Stories, Post, WhatsApp, etc.).</Passo>
      <Passo n={3}>A IA adapta o tom, formato e tamanho para o canal escolhido.</Passo>

      <p className="mt-4 mb-2 text-sm font-semibold text-slate-800">Gerar imagem:</p>
      <Passo n={1}>Descreva a imagem que deseja (ex: &quot;família brasileira em praça pública, clima de esperança&quot;).</Passo>
      <Passo n={2}>Selecione o formato: Stories (9:16), Post (1:1), Facebook/Twitter (16:9).</Passo>
      <Passo n={3}>A IA gera a imagem usando Gemini. A imagem vem <strong>sem texto e sem rostos identificáveis</strong> — o overlay legal é adicionado manualmente pela equipe.</Passo>
      <Alerta>A geração de imagem requer chave Gemini configurada em Cadastro de Campanha → Chaves de API.</Alerta>

      <H3>11.2 Impulsionamento (Ads)</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Planejamento de <strong>impulsionamento de anúncios</strong> no Meta Ads (Instagram/Facebook).
        A IA gera um plano completo com segmentação de público, distribuição de orçamento, cronograma
        e métricas esperadas.
      </p>
      <Passo n={1}>Acesse <strong>Marketing → Impulsionamento</strong>.</Passo>
      <Passo n={2}>Descreva a peça que será impulsionada (ou selecione uma peça existente).</Passo>
      <Passo n={3}>Defina o <strong>objetivo</strong> (alcance, tráfego, engajamento, visualizações, conversão, mensagens, seguidores).</Passo>
      <Passo n={4}>Informe o <strong>público prioritário</strong> ou clique em <strong>&quot;Sugerir público&quot;</strong> para a IA recomendar.</Passo>
      <Passo n={5}>Defina o <strong>orçamento total</strong> (R$) e o <strong>prazo</strong> (dias).</Passo>
      <Passo n={6}>Clique em <strong>&quot;Gerar plano&quot;</strong>. A IA criará um plano detalhado de impulsionamento.</Passo>
      <Passo n={7}>Revise o plano e use-o como guia para configurar a campanha no Meta Ads Manager.</Passo>
      <Dica>A sugestão de público usa a Base de Conhecimento para recomendar segmentações baseadas nos públicos-alvo e regiões cadastrados em cada tema.</Dica>

      <H3>11.3 Peças de Conteúdo</H3>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        Biblioteca de todas as peças de conteúdo da campanha (posts, stories, panfletos, vídeos, etc.).
        Cada peça pode passar por <strong>revisão de compliance eleitoral por IA</strong>, que verifica
        se o conteúdo está em conformidade com a legislação.
      </p>
      <Passo n={1}>Acesse <strong>Marketing → Peças de conteúdo</strong>.</Passo>
      <Passo n={2}>Veja a biblioteca com miniaturas, tipo, canal e status de revisão.</Passo>
      <Passo n={3}>Para adicionar uma nova peça, clique em <strong>&quot;Nova peça&quot;</strong>.</Passo>
      <Passo n={4}>Preencha tipo (imagem, vídeo, texto), canal, conteúdo/legenda e envie a arte se houver.</Passo>
      <Passo n={5}>Para revisar, clique em <strong>&quot;Revisar compliance&quot;</strong>. A IA verificará:</Passo>
      <ul className="ml-12 mb-3 list-disc space-y-1 text-sm text-slate-700">
        <li>Presença de identificação legal obrigatória (nome de urna, número, CNPJ, selo IA)</li>
        <li>Conteúdo potencialmente ilegal (ofensas, fake news, uso irregular de símbolos)</li>
        <li>Conformidade com resoluções do TSE sobre propaganda eleitoral</li>
        <li>Adequação de imagens (se a peça contém arte, a revisão usa visão computacional)</li>
      </ul>
      <Passo n={6}>O resultado da revisão aparece como checklist com itens OK e itens que precisam de correção.</Passo>
      <Alerta>Peças com imagem exigem chave Gemini para a revisão visual. Peças somente texto podem ser revisadas com qualquer provedor de IA configurado.</Alerta>

      {/* 12. Dicas */}
      <H2 id="dicas">12. Dicas e Boas Práticas</H2>

      <H3>Configuração inicial recomendada</H3>
      <div className="mb-4 text-sm leading-relaxed text-slate-700">
        <ol className="list-decimal space-y-2 pl-5">
          <li><strong>Cadastro de campanha</strong> — Preencha todos os dados do candidato. São usados na revisão de compliance.</li>
          <li><strong>Chaves de API</strong> — Configure pelo menos uma chave de IA (Gemini é suficiente para a maioria das funcionalidades).</li>
          <li><strong>Diretrizes</strong> — Defina tom de voz, posicionamentos e temas a evitar. Impacta toda a IA do sistema.</li>
          <li><strong>Base de Conhecimento</strong> — Cadastre os temas principais com propostas, públicos-alvo e regiões.</li>
          <li><strong>Usuários</strong> — Convide a equipe com os papéis adequados.</li>
          <li><strong>Concorrentes</strong> — Cadastre os principais concorrentes para o monitoramento.</li>
        </ol>
      </div>

      <H3>Segurança</H3>
      <div className="mb-4 text-sm leading-relaxed text-slate-700">
        <ul className="list-disc space-y-2 pl-5">
          <li>Use <strong>senhas fortes</strong> (mínimo 8 caracteres, misturando letras, números e símbolos).</li>
          <li>Não compartilhe seu login com outras pessoas. Cada membro deve ter seu próprio acesso.</li>
          <li>As chaves de API são criptografadas no banco de dados. Não as compartilhe por mensagem.</li>
          <li>O sistema mantém <strong>trilha de auditoria</strong> de todas as ações — tudo é rastreável.</li>
          <li>Dados pessoais estão protegidos por RLS (Row Level Security) — cada campanha só vê seus próprios dados.</li>
        </ul>
      </div>

      <H3>Dúvidas frequentes</H3>
      <div className="mb-4 text-sm leading-relaxed text-slate-700 space-y-4">
        <div>
          <p className="font-semibold">A IA não está respondendo. O que fazer?</p>
          <p>Verifique se há uma chave de API configurada em Cadastro de Campanha → Chaves de API. O sistema tenta Anthropic → OpenAI → Gemini → Grok, nessa ordem. Pelo menos uma precisa estar ativa.</p>
        </div>
        <div>
          <p className="font-semibold">Posso acessar pelo celular?</p>
          <p>Sim. O sistema é responsivo e funciona em qualquer navegador moderno. Use o menu ☰ para navegar no celular.</p>
        </div>
        <div>
          <p className="font-semibold">Como trocar de campanha?</p>
          <p>Apenas desenvolvedores da plataforma podem alternar entre campanhas (badge &quot;Dev&quot; no cabeçalho). Usuários regulares pertencem a uma única campanha.</p>
        </div>
        <div>
          <p className="font-semibold">O que significa &quot;Acesso por convite&quot;?</p>
          <p>Não existe cadastro público. O coordenador de campanha convida cada membro pelo e-mail. Isso garante que apenas pessoas autorizadas tenham acesso.</p>
        </div>
      </div>

      {/* Rodapé */}
      <div className="mt-16 border-t border-neutral-200 pt-6 text-center text-xs text-neutral-400 print:mt-8">
        <p>Eleito Online — Gestão Eleitoral Inteligente</p>
        <p>Versão 1.0 · Agosto 2026</p>
        <p className="mt-2 print:hidden">
          Para imprimir ou salvar como PDF, use <strong>Ctrl+P</strong> (ou ⌘+P no Mac) e selecione &quot;Salvar como PDF&quot;.
        </p>
      </div>
    </main>
  );
}
