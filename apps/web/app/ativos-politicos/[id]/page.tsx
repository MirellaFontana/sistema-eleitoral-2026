import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { AtivoPerfilClient } from "./AtivoPerfilClient";

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

export default async function AtivoPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const podeEditar = eu.papel === "coord_campanha" || eu.papel === "coord_marketing";

  const [{ data: ativo }, { data: relacionamentos }, { data: historico }, { data: categorias }] = await Promise.all([
    supabase
      .from("ativos_politicos")
      .select("*, categorias_ativo_politico(nome, grupo, cor), territorios(nome_bairro, cidade)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("relacionamentos_ativos")
      .select("id, ativo_origem_id, ativo_destino_id, observacoes, created_at, tipos_relacionamento_ativo(nome), origem:ativos_politicos!ativo_origem_id(id, nome, cargo_atual), destino:ativos_politicos!ativo_destino_id(id, nome, cargo_atual)")
      .or(`ativo_origem_id.eq.${id},ativo_destino_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("historico_ativos")
      .select("id, tipo, titulo, descricao, data_ocorrencia, created_at")
      .eq("ativo_id", id)
      .order("data_ocorrencia", { ascending: false })
      .limit(30),
    supabase
      .from("categorias_ativo_politico")
      .select("id, nome, grupo")
      .eq("ativo", true)
      .order("ordem"),
  ]);

  if (!ativo) notFound();

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <AtivoPerfilClient
        ativo={ativo}
        categorias={categorias ?? []}
        relacionamentos={(relacionamentos ?? []) as never[]}
        historico={(historico ?? []) as never[]}
        podeEditar={podeEditar}
      />
    </AppShell>
  );
}
