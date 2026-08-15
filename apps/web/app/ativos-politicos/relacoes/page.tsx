import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { RelacoesClient } from "./RelacoesClient";

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

export default async function RelacoesPage() {
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

  const [{ data: relacionamentos, count }, { data: tiposRel }, { data: ativos }] = await Promise.all([
    supabase
      .from("relacionamentos_ativos")
      .select(
        "id, observacoes, created_at, tipos_relacionamento_ativo(nome, direcional), origem:ativos_politicos!ativo_origem_id(id, nome, cargo_atual), destino:ativos_politicos!ativo_destino_id(id, nome, cargo_atual)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("tipos_relacionamento_ativo").select("id, nome, direcional").order("nome"),
    supabase.from("ativos_politicos").select("id, nome").order("nome").limit(500),
  ]);

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <RelacoesClient
        relacionamentos={relacionamentos ?? []}
        total={count ?? 0}
        tiposRelacionamento={tiposRel ?? []}
        ativos={ativos ?? []}
        podeGerenciar={podeGerenciar}
      />
    </AppShell>
  );
}
