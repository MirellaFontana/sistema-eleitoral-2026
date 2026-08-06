import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { MonitoramentoForm } from "../../monitoramento/MonitoramentoForm";

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

const PAPEIS_QUE_REGISTRAM = new Set([
  "coord_campanha",
  "advogado_responsavel",
  "assistente_juridico",
  "coord_marketing",
  "redator_marketing",
]);

export default async function NovaDenunciaPage() {
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

  if (!PAPEIS_QUE_REGISTRAM.has(eu.papel)) redirect("/monitoramento");

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Registrar denúncia</h1>
          <p className="text-sm text-neutral-500">
            Recebeu uma denúncia pelo WhatsApp, redes sociais ou de um apoiador? Registre aqui.
            Anexe o print ou captura de tela — se for ameaça, deepfake ou crise, o sistema lacra a
            evidência automaticamente com hash SHA-256.
          </p>
        </div>

        <MonitoramentoForm campanhaId={eu.campanha_id} />

        <p className="text-xs text-neutral-400">
          Após registrar, o item aparece no Monitoramento e, se for categoria de ameaça com captura
          anexada, também no Dossiê jurídico como evidência lacrada.
        </p>
      </main>
    </AppShell>
  );
}
