import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { labelTerritorio } from "@/lib/territorio";
import { CampoClient } from "./CampoClient";

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

export default async function CampoPage() {
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

  const hoje = new Date();
  const semanaAtras = new Date(hoje.getTime() - 7 * 86_400_000).toISOString();

  const [{ data: territorios }, { data: membros }, { data: eventos }] = await Promise.all([
    supabase.from("territorios").select("id, nome_bairro, cidade").order("nome_bairro"),
    supabase.from("usuarios_internos").select("id, nome").order("nome"),
    supabase.from("eventos_campanha").select("id, titulo").gte("data_inicio", semanaAtras).neq("status", "cancelado").order("data_inicio", { ascending: false }).limit(20),
  ]);

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <CampoClient
        territorios={(territorios ?? []).map((t) => ({ id: t.id, nome: labelTerritorio(t.nome_bairro, t.cidade) }))}
        membros={(membros ?? []).map((m) => ({ id: m.id, nome: m.nome }))}
        eventos={(eventos ?? []).map((e) => ({ id: e.id, titulo: e.titulo }))}
        podeEncaminhar={["coord_campanha", "candidato"].includes(eu.papel)}
      />
    </AppShell>
  );
}
