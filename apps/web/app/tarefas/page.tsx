import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { TarefaForm } from "./TarefaForm";
import { TarefaCard, type TarefaView } from "./TarefaCard";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Liderança de campo (legado)",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
  apoio_marketing: "Apoio de marketing",
  apoio_campanha: "Apoio de campanha",
  apoio_coordenacao: "Apoio de coordenação",
};

const PAPEIS_QUE_EDITAM = new Set([
  "coord_campanha",
  "coord_marketing",
  "redator_marketing",
  "advogado_responsavel",
  "assistente_juridico",
]);

type LinhaTarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prazo: string | null;
  created_at: string;
  responsavel_id: string | null;
  usuarios_internos: { nome: string } | { nome: string }[] | null;
};

export default async function TarefasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) redirect("/onboarding");

  const rotaMfa = await proximaRotaMfa(supabase, eu.papel);
  if (rotaMfa) redirect(rotaMfa);

  const podeEditar = PAPEIS_QUE_EDITAM.has(eu.papel);
  const podeExcluir = eu.papel === "coord_campanha";
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const [{ data: tarefas }, { data: equipe }] = await Promise.all([
    supabase
      .from("tarefas")
      .select(
        "id, titulo, descricao, status, prazo, created_at, responsavel_id, usuarios_internos!responsavel_id(nome)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("usuarios_internos").select("id, nome").order("nome"),
  ]);

  const linhas: TarefaView[] = ((tarefas ?? []) as unknown as LinhaTarefa[]).map((t) => {
    const responsavel = Array.isArray(t.usuarios_internos) ? t.usuarios_internos[0] : t.usuarios_internos;
    return {
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      status: t.status,
      prazo: t.prazo,
      responsavelId: t.responsavel_id,
      responsavelNome: responsavel?.nome ?? null,
      createdAt: t.created_at,
    };
  });

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Tarefas</h1>
          <p className="text-sm text-neutral-500">
            Cadastro de atividades da equipe — com descrição e responsável escolhido diretamente
            do cadastro de usuários.
          </p>
        </div>

        {podeEditar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Nova tarefa
            </h2>
            <TarefaForm campanhaId={eu.campanha_id} equipe={equipe ?? []} />
          </section>
        )}

        <section className="space-y-3">
          {linhas.length === 0 && (
            <p className="text-sm text-neutral-400">Nenhuma tarefa registrada ainda.</p>
          )}
          <ul className="space-y-2">
            {linhas.map((t) => (
              <TarefaCard
                key={t.id}
                tarefa={t}
                equipe={equipe ?? []}
                podeEditar={podeEditar}
                podeExcluir={podeExcluir}
              />
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
