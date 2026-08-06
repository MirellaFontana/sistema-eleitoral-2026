export type FuncaoView = {
  id: string;
  nome: string;
  descricao: string | null;
  sistema: boolean;
  permissoes: string[];
  membros: number;
};

export const PERMISSOES_POR_GRUPO: { grupo: string; permissoes: { valor: string; label: string }[] }[] = [
  {
    grupo: "Cadastros",
    permissoes: [
      { valor: "ver_eleitores", label: "Ver eleitores" },
      { valor: "cadastrar_eleitores", label: "Cadastrar eleitores" },
      { valor: "editar_eleitores", label: "Editar/desativar eleitores" },
      { valor: "ver_apoiadores", label: "Ver apoiadores" },
      { valor: "gerenciar_apoiadores", label: "Gerenciar apoiadores" },
      { valor: "ver_liderancas", label: "Ver lideranças" },
      { valor: "gerenciar_liderancas", label: "Gerenciar lideranças" },
    ],
  },
  {
    grupo: "Comunicação",
    permissoes: [
      { valor: "enviar_mensagens", label: "Enviar mensagens" },
      { valor: "gerenciar_modelos", label: "Gerenciar modelos de mensagem" },
      { valor: "aprovar_modelos", label: "Aprovar modelos" },
      { valor: "publicar_avisos", label: "Publicar avisos internos" },
    ],
  },
  {
    grupo: "Marketing",
    permissoes: [
      { valor: "gerenciar_pecas", label: "Gerenciar peças de conteúdo" },
      { valor: "aprovar_pecas", label: "Aprovar/publicar peças" },
      { valor: "usar_ia", label: "Usar ferramentas de IA" },
      { valor: "gerenciar_concorrentes", label: "Gerenciar concorrentes" },
      { valor: "gerenciar_demandas", label: "Gerenciar demandas" },
    ],
  },
  {
    grupo: "Gestão",
    permissoes: [
      { valor: "gerenciar_agenda", label: "Gerenciar agenda" },
      { valor: "gerenciar_tarefas", label: "Gerenciar tarefas" },
      { valor: "gerenciar_territorios", label: "Gerenciar territórios" },
      { valor: "gerenciar_base_conhecimento", label: "Gerenciar base de conhecimento" },
    ],
  },
  {
    grupo: "Monitoramento / Jurídico",
    permissoes: [
      { valor: "registrar_monitoramento", label: "Registrar monitoramento" },
      { valor: "ver_auditoria", label: "Ver trilha de auditoria" },
    ],
  },
];
