import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { RecomendacoesClient } from "./RecomendacoesClient";

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

export default async function RecomendacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) redirect("/onboarding");

  const rotaMfa = await proximaRotaMfa(supabase, eu.papel);
  if (rotaMfa) redirect(rotaMfa);

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const { data: membros } = await supabase
    .from("usuarios_internos")
    .select("id, nome")
    .order("nome");

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <RecomendacoesClient
        podeDecidir={["coord_campanha", "candidato"].includes(eu.papel)}
        podeGerar={["coord_campanha", "candidato", "coord_marketing"].includes(eu.papel)}
        membros={(membros ?? []).map((m) => ({ id: m.id, nome: m.nome }))}
      />
    </AppShell>
  );
}
