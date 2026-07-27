import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { ImpulsionamentoForm } from "../ImpulsionamentoForm";
import { PlanoImpulsionamentoCard, type PlanoRow } from "../PlanoImpulsionamentoCard";

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

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

export default async function ImpulsionamentoPage() {
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

  if (!PAPEIS_QUE_GERAM.has(eu.papel)) {
    redirect("/marketing");
  }

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const { data: planosData } = await supabase
    .from("planos_impulsionamento")
    .select(
      "id, peca_descricao, objetivo, publico_prioritario, orcamento_total, prazo_dias, plano_json, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const planos = (planosData ?? []) as PlanoRow[];

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Impulsionamento pago (Meta Ads)</h1>
          <p className="text-sm text-neutral-500">
            Método Pedro Sobral adaptado a campanha eleitoral brasileira. A IA monta plano tático
            com estrutura CBO, teste 3×3 (públicos × criativos), benchmarks BR, kill/scale rules
            matemáticos e compliance eleitoral (autorização Meta, CNPJ, número, selo IA).
          </p>
          <p className="mt-2 text-xs text-neutral-400">
            A execução no Ads Manager e o tracking dos resultados reais continuam sendo
            responsabilidade da equipe — este módulo só entrega o plano.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Novo plano
          </h2>
          <ImpulsionamentoForm />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Planos gerados
          </h2>
          {planos.length === 0 && (
            <p className="text-sm text-neutral-400">Nenhum plano gerado ainda.</p>
          )}
          <ul className="space-y-2">
            {planos.map((p) => (
              <PlanoImpulsionamentoCard key={p.id} plano={p} />
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
