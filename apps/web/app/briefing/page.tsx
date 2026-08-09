import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { BriefingDiario } from "../dashboard/BriefingDiario";

const PAPEIS_BRIEFING_DIRETO = new Set(["candidato", "coord_campanha"]);

export default async function BriefingPage() {
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

  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimDia = new Date(inicioDia.getTime() + 86_400_000);

  const [briefingHojeRes, eventosHoje, podeIaRes] = await Promise.all([
    supabase
      .from("briefings_diarios")
      .select("conteudo, created_at")
      .eq("data", hojeIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("eventos_campanha")
      .select("*", { count: "exact", head: true })
      .gte("data_inicio", inicioDia.toISOString())
      .lt("data_inicio", fimDia.toISOString())
      .neq("status", "cancelado"),
    PAPEIS_BRIEFING_DIRETO.has(eu.papel)
      ? Promise.resolve({ data: true })
      : supabase.rpc("has_permission", { p: "usar_ia" }),
  ]);

  return (
    <AppShell campanhaNome={campanha?.nome_candidato} papel={eu.papel}>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <h1 className="text-lg font-semibold text-neutral-800">Briefing diário</h1>
        <BriefingDiario
          briefingInicial={briefingHojeRes.data ?? null}
          podeGerar={podeIaRes.data === true}
          eventosHoje={eventosHoje.count ?? 0}
        />
      </main>
    </AppShell>
  );
}
