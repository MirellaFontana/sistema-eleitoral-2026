import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { FuncaoCard } from "./FuncaoCard";
import { FuncaoForm } from "./FuncaoForm";

const PERMISSOES_POR_GRUPO: { grupo: string; permissoes: { valor: string; label: string }[] }[] = [
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

export type FuncaoView = {
  id: string;
  nome: string;
  descricao: string | null;
  sistema: boolean;
  permissoes: string[];
  membros: number;
};

export { PERMISSOES_POR_GRUPO };

export default async function FuncoesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, nome, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) redirect("/onboarding");

  const rotaMfa = await proximaRotaMfa(supabase, eu.papel);
  if (rotaMfa) redirect(rotaMfa);

  const isCoordCampanha = eu.papel === "coord_campanha";
  const campanhaNome =
    (Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas)?.nome_candidato ?? "";

  const { data: funcoes } = await supabase
    .from("funcoes_campanha")
    .select("id, nome, descricao, sistema")
    .order("sistema", { ascending: false })
    .order("nome");

  const { data: todasPermissoes } = await supabase
    .from("funcao_permissoes")
    .select("funcao_id, permissao");

  const { data: usuarios } = await supabase
    .from("usuarios_internos")
    .select("funcao_id")
    .eq("status", "ativo");

  const permissoesPorFuncao: Record<string, string[]> = {};
  for (const fp of todasPermissoes ?? []) {
    if (!permissoesPorFuncao[fp.funcao_id]) permissoesPorFuncao[fp.funcao_id] = [];
    permissoesPorFuncao[fp.funcao_id].push(fp.permissao);
  }

  const membrosPorFuncao: Record<string, number> = {};
  for (const u of usuarios ?? []) {
    if (u.funcao_id) {
      membrosPorFuncao[u.funcao_id] = (membrosPorFuncao[u.funcao_id] ?? 0) + 1;
    }
  }

  const funcoesView: FuncaoView[] = (funcoes ?? []).map((f) => ({
    id: f.id,
    nome: f.nome,
    descricao: f.descricao,
    sistema: f.sistema,
    permissoes: permissoesPorFuncao[f.id] ?? [],
    membros: membrosPorFuncao[f.id] ?? 0,
  }));

  return (
    <AppShell campanhaNome={campanhaNome} papel={eu.papel}>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Funções e permissões</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Gerencie as funções da equipe e defina quais permissões cada uma tem.
            Controles não-delegáveis (editar campanha, revogar acesso, encaminhar à Justiça)
            permanecem restritos ao papel fixo.
          </p>
        </div>

        {isCoordCampanha && <FuncaoForm />}

        <div className="space-y-4">
          {funcoesView.map((f) => (
            <FuncaoCard
              key={f.id}
              funcao={f}
              isCoordCampanha={isCoordCampanha}
              permissoesPorGrupo={PERMISSOES_POR_GRUPO}
            />
          ))}
        </div>

        {funcoesView.length === 0 && (
          <p className="text-sm text-neutral-400">Nenhuma função cadastrada.</p>
        )}
      </div>
    </AppShell>
  );
}
