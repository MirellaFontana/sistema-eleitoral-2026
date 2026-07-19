import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { PecaForm } from "./PecaForm";
import { PecaCard } from "./PecaCard";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Embaixador",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
};

const PAPEIS_QUE_CRIAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);
const PAPEIS_QUE_APROVAM = new Set([
  "coord_campanha",
  "coord_marketing",
  "advogado_responsavel",
  "assistente_juridico",
]);

export default async function PecasConteudoPage() {
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

  const podeCriar = PAPEIS_QUE_CRIAM.has(eu.papel);
  const podeAprovar = PAPEIS_QUE_APROVAM.has(eu.papel);
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const { data: pecas } = await supabase
    .from("pecas_conteudo")
    .select(
      "id, tipo, canal, usou_ia, ferramenta, rotulo_aplicado, rotulo_texto, aprovador_id, status, publicado_em, created_at"
    )
    .order("created_at", { ascending: false });

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Peças de conteúdo</h1>
          <p className="text-sm text-neutral-500">
            Conformidade e rotulagem IA (Módulo Jurídico) — toda peça gerada ou significativamente
            alterada por IA precisa de rótulo aplicado e aprovação humana antes de publicar. Peças
            sintéticas novas não publicam na janela de silêncio de 72h antes / 24h depois do pleito.
          </p>
        </div>

        {podeCriar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Novo rascunho
            </h2>
            <PecaForm campanhaId={eu.campanha_id} criadoPor={user.id} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Peças</h2>

          {(pecas ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">Nenhuma peça registrada ainda.</p>
          )}

          <ul className="space-y-2">
            {(pecas ?? []).map((peca) => (
              <PecaCard key={peca.id} peca={peca} podeAprovar={podeAprovar} currentUserId={user.id} />
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
