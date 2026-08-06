import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { FuncaoCard } from "./FuncaoCard";
import { FuncaoForm } from "./FuncaoForm";
import { PERMISSOES_POR_GRUPO, type FuncaoView } from "./funcoes-shared";

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
