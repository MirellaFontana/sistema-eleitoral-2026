import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { ConcorrenteForm } from "./ConcorrenteForm";
import { ConcorrentesList } from "./ConcorrentesList";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Embaixador",
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

const PAPEIS_QUE_EDITAM = new Set(["coord_campanha", "coord_marketing"]);

export default async function ConcorrentesPage() {
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
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const { data: concorrentes } = await supabase
    .from("concorrentes")
    .select("id, nome, partido, pontos_fortes, pontos_fracos, promessas, dossie_mandato, argumentos, created_at")
    .order("created_at", { ascending: false });

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Concorrentes</h1>
          <p className="text-sm text-neutral-500">
            Análise de oposição — pontos fortes/fracos, promessas, dossiê do mandato e argumentos.
          </p>
        </div>

        {podeEditar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Adicionar concorrente
            </h2>
            <ConcorrenteForm campanhaId={eu.campanha_id} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Registrados
          </h2>

          <ConcorrentesList concorrentes={concorrentes ?? []} podeEditar={podeEditar} />
        </section>
      </main>
    </AppShell>
  );
}
