import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { MonitoramentoWorkspace } from "./MonitoramentoWorkspace";
import { FontesPanel } from "./FontesPanel";
import { UltimoSnapshot } from "./UltimoSnapshot";
import { ItensRegistrados } from "./ItensRegistrados";
import type { TermoView } from "./TermosMonitoramento";

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

export default async function MonitoramentoPage() {
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

  const podeRegistrar = PAPEIS_QUE_REGISTRAM.has(eu.papel);
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  let intervaloMonitoramento: number | null = 3;
  const { data: configCampanha } = await supabase
    .from("campanhas")
    .select("intervalo_monitoramento_horas")
    .eq("id", eu.campanha_id)
    .maybeSingle();
  if (configCampanha) {
    intervaloMonitoramento = configCampanha.intervalo_monitoramento_horas;
  }

  // Semeia o próprio candidato como primeiro termo monitorado, uma única vez por campanha —
  // mantém o comportamento de antes (buscava o candidato automaticamente) sem exigir que
  // alguém cadastre isso manualmente antes de usar a busca pela primeira vez.
  if (podeRegistrar && campanha?.nome_candidato) {
    const { count } = await supabase
      .from("termos_monitoramento")
      .select("*", { count: "exact", head: true });
    if (count === 0) {
      await supabase.from("termos_monitoramento").insert({
        campanha_id: eu.campanha_id,
        termo: campanha.nome_candidato,
        rotulo: "Candidato",
      });
    }
  }

  const [{ data: itens }, { data: termosData }, { data: fontesData }, { data: snapshotsData }] = await Promise.all([
    supabase
      .from("monitoramento_itens")
      .select("id, url, descricao, categoria, gravidade, status, captura_path, hash_evidencia, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("termos_monitoramento")
      .select("id, termo, rotulo, ativo")
      .order("created_at"),
    supabase
      .from("fontes_monitoramento")
      .select("id, dominio, nome, tier, regiao, ativo")
      .order("tier")
      .order("nome"),
    supabase
      .from("monitoramento_snapshots")
      .select("id, total_mencoes, analise_ia, provedor_ia, erro, created_at")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const termos: TermoView[] = termosData ?? [];
  const fontes = fontesData ?? [];
  const ultimoSnapshot = snapshotsData?.[0] ?? null;

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Monitoramento</h1>
          <p className="text-sm text-neutral-500">
            Menções ao candidato encontradas na internet — de ameaça jurídica e gestão de crise a
            menções de sentimento e oportunidades de marketing.
          </p>
        </div>

        <FontesPanel campanhaId={eu.campanha_id} fontes={fontes} podeEditar={podeRegistrar} />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Busca automática
          </h2>
          <UltimoSnapshot
            snapshot={ultimoSnapshot}
            intervaloAtual={intervaloMonitoramento}
            podeConfigurar={podeRegistrar}
          />
        </section>

        {podeRegistrar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Registrar item
            </h2>
            <MonitoramentoWorkspace campanhaId={eu.campanha_id} termos={termos} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Itens registrados
          </h2>

          <ItensRegistrados itens={itens ?? []} />
        </section>
      </main>
    </AppShell>
  );
}
