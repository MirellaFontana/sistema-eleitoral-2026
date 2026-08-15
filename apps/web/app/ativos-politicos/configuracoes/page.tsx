import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { ConfigClient } from "./ConfigClient";

const PAPEL_LABEL: Record<string, string> = {
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  embaixador: "Liderança de campo (legado)",
  apoio_marketing: "Apoio de marketing",
  apoio_campanha: "Apoio de campanha",
  apoio_coordenacao: "Apoio de coordenação",
};

export default async function ConfigPage() {
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
  const podeGerenciar = eu.papel === "coord_campanha" || eu.papel === "coord_marketing";

  if (!podeGerenciar) redirect("/ativos-politicos");

  const [{ data: categorias }, { data: tiposRel }] = await Promise.all([
    supabase
      .from("categorias_ativo_politico")
      .select("id, nome, grupo, cor, icone, ativo, ordem")
      .order("ordem"),
    supabase
      .from("tipos_relacionamento_ativo")
      .select("id, nome, direcional")
      .order("nome"),
  ]);

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <ConfigClient
        categorias={categorias ?? []}
        tiposRelacionamento={tiposRel ?? []}
        campanhaId={eu.campanha_id}
      />
    </AppShell>
  );
}
