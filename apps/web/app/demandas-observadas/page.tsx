import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { DemandaForm } from "./DemandaForm";

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

  const { data: demandas } = await supabase
    .from("demandas_observadas")
    .select("id, regiao, cidade, tema, demanda, created_at")
    .order("created_at", { ascending: false });

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Demandas observadas</h1>
          <p className="text-sm text-neutral-500">
            Nota de referência dos temas que mais aparecem por região — não é o fluxo formal de
            cidadão relata/mandato encaminha (isso vem depois, como módulo próprio).
          </p>
        </div>

        {podeEditar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Registrar demanda
            </h2>
            <DemandaForm campanhaId={eu.campanha_id} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Registradas
          </h2>

          {(demandas ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">Nenhuma demanda registrada ainda.</p>
          )}

          <ul className="space-y-2">
            {(demandas ?? []).map((d) => (
              <li key={d.id} className="rounded border border-neutral-200 p-3 space-y-1">
                <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                  {d.tema && <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">{d.tema}</span>}
                  {(d.regiao || d.cidade) && (
                    <span>
                      {d.regiao}
                      {d.regiao && d.cidade ? " · " : ""}
                      {d.cidade}
                    </span>
                  )}
                </div>
                <p className="text-sm">{d.demanda}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
