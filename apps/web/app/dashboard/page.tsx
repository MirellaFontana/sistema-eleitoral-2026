import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Heart,
  Network,
  ListChecks,
  Bell,
  ClipboardList,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
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

const ESTAGIO_LABEL: Record<string, string> = {
  atracao: "Atração",
  interacao: "Interação",
  ativacao: "Ativação",
  advocacia: "Advocacia",
};

const CIRCULO_META: { valor: string; label: string; cor: string }[] = [
  { valor: "quente", label: "Quente", cor: "bg-rose-500" },
  { valor: "morno", label: "Morno", cor: "bg-amber-400" },
  { valor: "frio", label: "Frio", cor: "bg-sky-400" },
];

const SEMANA_MS = 7 * 86_400_000;

async function contar(query: PromiseLike<{ count: number | null }>): Promise<number> {
  const { count } = await query;
  return count ?? 0;
}

// Segunda-feira 00:00 da semana da data (semana começando na segunda, padrão BR).
function inicioSemana(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function diasAte(dataIso: string, hoje: Date): number {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const alvo = new Date(ano, mes - 1, dia);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm shadow-neutral-900/5">
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">{titulo}</h2>
      {children}
    </section>
  );
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

  const hoje = new Date();
  const semanaInicial = new Date(inicioSemana(hoje).getTime() - 7 * SEMANA_MS);
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  // Contagens e detalhes respeitam a RLS da sessão — papel sem acesso a uma tabela vê
  // zero/vazio na seção correspondente, sem lógica extra por papel.
  const [
    eleitores,
    apoiadores,
    liderancas,
    tarefasAFazer,
    alertasPendentes,
    demandas,
    cidadaosDetRes,
    apoiadoresSemanaRes,
    liderancasSemanaRes,
    territoriosRes,
    proximoPrazoRes,
  ] = await Promise.all([
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
    supabase.from("cidadaos").select("created_at, circulo, estagio, territorio_id"),
    supabase.from("apoiadores").select("created_at").gte("created_at", semanaInicial.toISOString()),
    supabase.from("liderancas").select("created_at").gte("created_at", semanaInicial.toISOString()),
    supabase.from("territorios").select("id, nome_bairro, votos_disponiveis_estimados"),
    supabase
      .from("prazos_eleitorais")
      .select("data, titulo")
      .gte("data", hojeIso)
      .order("data")
      .limit(1)
      .maybeSingle(),
  ]);

  const cidadaosDet = cidadaosDetRes.data ?? [];
  const territorios = territoriosRes.data ?? [];
  const proximoPrazo = proximoPrazoRes.data;

  // ── Crescimento semanal (8 semanas, seg a dom) ─────────────────────────────
  const semanas = Array.from({ length: 8 }, (_, i) => new Date(semanaInicial.getTime() + i * SEMANA_MS));

  function bucketSemanal(datas: (string | null)[]): number[] {
    const contagens = new Array(8).fill(0);
    for (const d of datas) {
      if (!d) continue;
      const idx = Math.floor((inicioSemana(new Date(d)).getTime() - semanaInicial.getTime()) / SEMANA_MS);
      if (idx >= 0 && idx < 8) contagens[idx] += 1;
    }
    return contagens;
  }

  const serieEleitores = bucketSemanal(cidadaosDet.map((c) => c.created_at));
  const serieApoiadores = bucketSemanal((apoiadoresSemanaRes.data ?? []).map((a) => a.created_at));
  const serieLiderancas = bucketSemanal((liderancasSemanaRes.data ?? []).map((l) => l.created_at));
  const maxSemana = Math.max(1, ...serieEleitores, ...serieApoiadores, ...serieLiderancas);

  const series: { label: string; cor: string; valores: number[] }[] = [
    { label: "Eleitores", cor: "bg-indigo-500", valores: serieEleitores },
    { label: "Apoiadores", cor: "bg-sky-400", valores: serieApoiadores },
    { label: "Lideranças", cor: "bg-emerald-400", valores: serieLiderancas },
  ];

  // ── Temperatura e funil ────────────────────────────────────────────────────
  const porCirculo = Object.fromEntries(CIRCULO_META.map((c) => [c.valor, 0]));
  const porEstagio: Record<string, number> = { atracao: 0, interacao: 0, ativacao: 0, advocacia: 0 };
  const porTerritorio = new Map<string, number>();
  for (const c of cidadaosDet) {
    if (c.circulo in porCirculo) porCirculo[c.circulo] += 1;
    if (c.estagio in porEstagio) porEstagio[c.estagio] += 1;
    if (c.territorio_id) porTerritorio.set(c.territorio_id, (porTerritorio.get(c.territorio_id) ?? 0) + 1);
  }
  const totalCirculo = cidadaosDet.length;
  const maxEstagio = Math.max(1, ...Object.values(porEstagio));

  // ── Cobertura por território (top 5) ───────────────────────────────────────
  const cobertura = territorios
    .map((t) => ({
      nome: t.nome_bairro ?? "sem nome",
      contagem: porTerritorio.get(t.id) ?? 0,
      estimativa: t.votos_disponiveis_estimados,
    }))
    .filter((t) => t.contagem > 0)
    .sort((a, b) => b.contagem - a.contagem)
    .slice(0, 5);

  const cards: { label: string; valor: number; icon: LucideIcon; tint: "indigo" | "amber" }[] = [
    { label: "Eleitores", valor: eleitores, icon: Users, tint: "indigo" },
    { label: "Apoiadores ativos", valor: apoiadores, icon: Heart, tint: "indigo" },
    { label: "Lideranças ativas", valor: liderancas, icon: Network, tint: "indigo" },
    { label: "Tarefas a fazer", valor: tarefasAFazer, icon: ListChecks, tint: "indigo" },
    { label: "Alertas pendentes", valor: alertasPendentes, icon: Bell, tint: "amber" },
    { label: "Demandas registradas", valor: demandas, icon: ClipboardList, tint: "indigo" },
  ];

  const diasPrazo = proximoPrazo ? diasAte(proximoPrazo.data, hoje) : null;
  const prazoUrgente = diasPrazo !== null && diasPrazo <= 7;

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="flex-1 px-6 py-6">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="mb-6 text-sm text-neutral-500">
          {campanha?.nome_candidato
            ? `Visão geral da campanha ${campanha.nome_candidato}`
            : "Visão geral da campanha"}
        </p>

        {proximoPrazo && diasPrazo !== null && (
          <Link
            href="/calendario-eleitoral"
            className={`mb-6 flex items-center gap-2 rounded-xl border p-3 text-sm ${
              prazoUrgente
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-indigo-100 bg-indigo-50 text-indigo-900"
            }`}
          >
            <CalendarClock size={16} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="font-semibold">Próximo prazo:</span> {proximoPrazo.titulo} —{" "}
              {diasPrazo === 0 ? "é hoje" : `faltam ${diasPrazo} ${diasPrazo === 1 ? "dia" : "dias"}`}
            </span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm shadow-neutral-900/5"
            >
              <div
                className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${
                  c.tint === "amber" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-600"
                }`}
              >
                <c.icon size={16} strokeWidth={2} aria-hidden="true" />
              </div>
              <p className="text-xs text-neutral-500">{c.label}</p>
              <p className="text-2xl font-semibold">{c.valor}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Secao titulo="Crescimento semanal (últimas 8 semanas)">
            <div className="flex items-end gap-1.5">
              {semanas.map((s, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="flex h-24 w-full items-end justify-center gap-0.5">
                    {series.map((serie) => (
                      <div
                        key={serie.label}
                        title={`${serie.label}: ${serie.valores[i]}`}
                        className={`w-1.5 rounded-t ${serie.cor}`}
                        style={{ height: `${(serie.valores[i] / maxSemana) * 100}%` }}
                      />
                    ))}
                  </div>
                  <span className={`text-[10px] ${i === 7 ? "font-semibold text-neutral-700" : "text-neutral-400"}`}>
                    {String(s.getDate()).padStart(2, "0")}/{String(s.getMonth() + 1).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {series.map((serie) => (
                <span key={serie.label} className="flex items-center gap-1 text-xs text-neutral-500">
                  <span className={`h-2 w-2 rounded-sm ${serie.cor}`} aria-hidden="true" />
                  {serie.label} ({serie.valores[7]} nesta semana)
                </span>
              ))}
            </div>
          </Secao>

          <Secao titulo="Temperatura da base de eleitores">
            {totalCirculo === 0 ? (
              <p className="text-sm text-neutral-400">Sem eleitores cadastrados ainda.</p>
            ) : (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-neutral-100">
                  {CIRCULO_META.map((c) =>
                    porCirculo[c.valor] > 0 ? (
                      <div
                        key={c.valor}
                        className={c.cor}
                        style={{ width: `${(porCirculo[c.valor] / totalCirculo) * 100}%` }}
                        title={`${c.label}: ${porCirculo[c.valor]}`}
                      />
                    ) : null
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  {CIRCULO_META.map((c) => (
                    <span key={c.valor} className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <span className={`h-2 w-2 rounded-full ${c.cor}`} aria-hidden="true" />
                      {c.label}: <strong className="text-neutral-700">{porCirculo[c.valor]}</strong> (
                      {Math.round((porCirculo[c.valor] / totalCirculo) * 100)}%)
                    </span>
                  ))}
                </div>
              </>
            )}
          </Secao>

          <Secao titulo="Funil de engajamento">
            <div className="space-y-2">
              {Object.entries(porEstagio).map(([estagio, valor]) => (
                <div key={estagio} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-neutral-500">
                    {ESTAGIO_LABEL[estagio] ?? estagio}
                  </span>
                  <div className="h-4 min-w-0 flex-1 rounded bg-neutral-100">
                    <div
                      className="h-full rounded bg-indigo-500"
                      style={{ width: `${(valor / maxEstagio) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-medium text-neutral-700">
                    {valor}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Conversão: {eleitores} eleitores → {apoiadores} apoiadores ativos (
              {eleitores > 0 ? Math.round((apoiadores / eleitores) * 100) : 0}%) → {liderancas}{" "}
              lideranças ativas
            </p>
          </Secao>

          <Secao titulo="Cobertura por território (top 5)">
            {cobertura.length === 0 ? (
              <p className="text-sm text-neutral-400">
                Nenhum eleitor vinculado a território ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {cobertura.map((t) => {
                  const pct =
                    t.estimativa > 0 ? Math.round((t.contagem / t.estimativa) * 100) : null;
                  return (
                    <div key={t.nome} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-xs text-neutral-500" title={t.nome}>
                        {t.nome}
                      </span>
                      <div className="h-4 min-w-0 flex-1 rounded bg-neutral-100">
                        <div
                          className="h-full rounded bg-emerald-400"
                          style={{
                            width: `${pct !== null ? Math.min(pct, 100) : Math.min((t.contagem / Math.max(1, cobertura[0].contagem)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs font-medium text-neutral-700">
                        {t.contagem}
                        {pct !== null ? ` (${pct}% do alvo)` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Secao>
        </div>
      </main>
    </AppShell>
  );
}
