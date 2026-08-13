import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { MonitoramentoWorkspace } from "./MonitoramentoWorkspace";
import { FontesPanel } from "./FontesPanel";
import { UltimoSnapshot } from "./UltimoSnapshot";
import { ItensRegistrados } from "./ItensRegistrados";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { AlertasPanel } from "./AlertasPanel";
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

  const [{ data: itens }, { data: termosData }, { data: fontesData }, { data: snapshotsData }, { data: alertasData }] = await Promise.all([
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
      .select("id, total_mencoes, analise_ia, resultados_brutos, provedor_ia, erro, created_at")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("alertas")
      .select("id, texto_ia, canal, status_envio, lido_em, created_at, monitoramento_item_id, snapshot_id, monitoramento_itens(url, descricao, categoria), monitoramento_snapshots(analise_ia, resultados_brutos)")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const termos: TermoView[] = termosData ?? [];
  const fontes = fontesData ?? [];
  const snapRaw = snapshotsData?.[0] ?? null;

  // Build flat link/date lists matching the same order the IA prompt used [i] indices
  let linksFlat: string[] = [];
  let datesFlat: (string | null)[] = [];
  if (snapRaw?.resultados_brutos) {
    const brutos = snapRaw.resultados_brutos as { noticias?: { link: string; publicadoEm?: string | null }[]; redes?: { resultados?: { link: string; publicadoEm?: string | null }[] } }[];
    for (const g of brutos) {
      for (const n of g.noticias ?? []) { linksFlat.push(n.link); datesFlat.push(n.publicadoEm ?? null); }
      for (const r of g.redes?.resultados ?? []) { linksFlat.push(r.link); datesFlat.push(r.publicadoEm ?? null); }
    }
  }

  const alertas = (alertasData ?? []).map((a: Record<string, unknown>) => {
    const item = Array.isArray(a.monitoramento_itens) ? a.monitoramento_itens[0] : a.monitoramento_itens;
    const snap = Array.isArray(a.monitoramento_snapshots) ? a.monitoramento_snapshots[0] : a.monitoramento_snapshots;
    return {
      id: a.id as string,
      texto_ia: a.texto_ia as string | null,
      canal: a.canal as string,
      status_envio: a.status_envio as string,
      lido_em: a.lido_em as string | null,
      created_at: a.created_at as string,
      monitoramento_itens: item as { url: string | null; descricao: string; categoria: string } | null,
      snapshot_analise: snap?.analise_ia as { grupos: { titulo_grupo: string; sentimento: string; mencoes: { fonte: string; titulo_original: string }[] }[] } | null,
      snapshot_brutos: snap?.resultados_brutos as { noticias?: { link: string; fonte: string; publicadoEm?: string | null }[]; redes?: { resultados?: { link: string; fonte: string; publicadoEm?: string | null }[] } }[] | null,
    };
  });

  const ultimoSnapshot = snapRaw ? {
    id: snapRaw.id,
    total_mencoes: snapRaw.total_mencoes,
    analise_ia: snapRaw.analise_ia,
    provedor_ia: snapRaw.provedor_ia,
    erro: snapRaw.erro,
    created_at: snapRaw.created_at,
  } : null;

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Monitoramento</h1>
            <p className="text-sm text-neutral-500">
              Menções ao candidato encontradas na internet — de ameaça jurídica e gestão de crise a
              menções de sentimento e oportunidades de marketing.
            </p>
          </div>
          <BotaoImprimir />
        </div>

        <AlertasPanel alertas={alertas} campanhaId={eu.campanha_id} />

        {podeRegistrar && (
          <MonitoramentoWorkspace campanhaId={eu.campanha_id} termos={termos} />
        )}

        <FontesPanel campanhaId={eu.campanha_id} fontes={fontes} podeEditar={podeRegistrar} />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Busca automática
          </h2>
          <UltimoSnapshot
            snapshot={ultimoSnapshot}
            linksFlat={linksFlat}
            datesFlat={datesFlat}
            campanhaId={eu.campanha_id}
            intervaloAtual={intervaloMonitoramento}
            podeConfigurar={podeRegistrar}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Itens registrados
          </h2>

          <ItensRegistrados itens={itens ?? []} fontes={fontes} />
        </section>
      </main>
    </AppShell>
  );
}
