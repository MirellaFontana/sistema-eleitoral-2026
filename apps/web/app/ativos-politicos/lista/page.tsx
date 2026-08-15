import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { AtivosListaClient } from "./AtivosListaClient";

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

export default async function AtivosListaPage() {
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

  const [{ data: ativos, count }, { data: categorias }, { data: territorios }] = await Promise.all([
    supabase
      .from("ativos_politicos")
      .select(
        "id, nome, nome_social, cidade, estado, partido, cargo_atual, nivel_influencia, status_campanha, telefone, whatsapp, email, geolocalizacao, created_at, categoria_id, categorias_ativo_politico(nome, grupo)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("categorias_ativo_politico")
      .select("id, nome, grupo")
      .eq("ativo", true)
      .order("ordem"),
    supabase.from("territorios").select("id, nome_bairro, cidade").order("nome_bairro"),
  ]);

  const podeGerenciar = eu.papel === "coord_campanha" || eu.papel === "coord_marketing";

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <AtivosListaClient
        ativosIniciais={ativos ?? []}
        totalInicial={count ?? 0}
        categorias={categorias ?? []}
        territorios={territorios ?? []}
        podeGerenciar={podeGerenciar}
        campanhaId={eu.campanha_id}
      />
    </AppShell>
  );
}
