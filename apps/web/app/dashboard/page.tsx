import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Liderança de campo (legado)",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
};

async function contar(
  query: PromiseLike<{ count: number | null }>
): Promise<number> {
  const { count } = await query;
  return count ?? 0;
}

export default async function DashboardPage() {
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

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  // Contagens respeitam a RLS da sessão do próprio usuário — um papel sem acesso a
  // uma tabela simplesmente vê 0 aqui, sem precisar de lógica extra por papel.
  const [eleitores, apoiadores, liderancas, tarefasAFazer, alertasPendentes, demandas] =
    await Promise.all([
      contar(supabase.from("cidadaos").select("*", { count: "exact", head: true })),
      contar(
        supabase.from("apoiadores").select("*", { count: "exact", head: true }).eq("status", "ativo")
      ),
      contar(
        supabase.from("liderancas").select("*", { count: "exact", head: true }).eq("status", "ativa")
      ),
      contar(
        supabase.from("tarefas").select("*", { count: "exact", head: true }).eq("status", "a_fazer")
      ),
      contar(
        supabase
          .from("alertas")
          .select("*", { count: "exact", head: true })
          .eq("status_envio", "pendente_configuracao")
      ),
      contar(supabase.from("demandas_observadas").select("*", { count: "exact", head: true })),
    ]);

  const cards = [
    { label: "Eleitores", valor: eleitores },
    { label: "Apoiadores ativos", valor: apoiadores },
    { label: "Lideranças ativas", valor: liderancas },
    { label: "Tarefas a fazer", valor: tarefasAFazer },
    { label: "Alertas pendentes", valor: alertasPendentes },
    { label: "Demandas registradas", valor: demandas },
  ];

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="flex-1 px-6 py-6">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="mb-6 text-sm text-neutral-500">
          {campanha?.nome_candidato
            ? `Visão geral da campanha ${campanha.nome_candidato}`
            : "Visão geral da campanha"}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-500">{c.label}</p>
              <p className="text-2xl font-semibold">{c.valor}</p>
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
