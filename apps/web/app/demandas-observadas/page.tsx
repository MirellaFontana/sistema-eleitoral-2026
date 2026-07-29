import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { DemandaForm } from "./DemandaForm";
import { DemandasLista } from "./DemandasLista";

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

export default async function DemandasObservadasPage() {
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

  const [demandasRes, temasRes, territoriosRes, liderancasRes, membrosRes] = await Promise.all([
    supabase
      .from("demandas_observadas")
      .select("id, regiao, cidades, tema, demanda, status, prioridade, responsavel_id, encaminhamento, resposta, origem, prazo, devolutiva, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("temas_campanha")
      .select("id, nome")
      .order("ordem"),
    supabase
      .from("territorios")
      .select("cidade")
      .not("cidade", "is", null),
    supabase
      .from("liderancas")
      .select("cidade")
      .not("cidade", "is", null),
    supabase
      .from("usuarios_internos")
      .select("id, nome")
      .order("nome"),
  ]);
  const demandas = demandasRes.data;
  const temas = temasRes.data ?? [];

  const cidadesSet = new Set<string>();
  for (const t of territoriosRes.data ?? []) if (t.cidade) cidadesSet.add(t.cidade);
  for (const l of liderancasRes.data ?? []) if (l.cidade) cidadesSet.add(l.cidade);
  for (const d of demandas ?? []) {
    const arr = d.cidades as string[] | null;
    if (arr) for (const c of arr) cidadesSet.add(c);
  }
  const cidadesConhecidas = Array.from(cidadesSet).sort();

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Demandas</h1>
          <p className="text-sm text-neutral-500">
            Registro e acompanhamento de demandas da população por região — com ciclo operacional
            de triagem, encaminhamento e resolução.
          </p>
        </div>

        {podeEditar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Registrar demanda
            </h2>
            <DemandaForm campanhaId={eu.campanha_id} temas={temas} cidadesConhecidas={cidadesConhecidas} />
          </section>
        )}

        <DemandasLista
          demandas={(demandas ?? []).map((d) => ({
            ...d,
            cidades: (d.cidades as string[] | null) ?? [],
          }))}
          cidadesConhecidas={cidadesConhecidas}
          temas={temas}
          podeEditar={podeEditar}
          membros={(membrosRes.data ?? []).map((m) => ({ id: m.id, nome: m.nome }))}
        />
      </main>
    </AppShell>
  );
}
