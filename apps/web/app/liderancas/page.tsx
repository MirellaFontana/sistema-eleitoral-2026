import { redirect } from "next/navigation";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { LiderancaForm } from "./LiderancaForm";
import { LiderancasTable } from "./LiderancasTable";
import { MetaForm } from "./MetaForm";
import { MetaDeleteButton } from "./MetaDeleteButton";
import { TerritorioForm } from "./TerritorioForm";
import { labelTerritorio } from "@/lib/territorio";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Liderança de campo (legado)",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
};

const PAPEIS_QUE_GERENCIAM = new Set(["coord_campanha", "coord_marketing"]);

type Agregado = { lideranca_id: string; cadastros: number; cadastros_mes: number; apoiadores: number };
type AgregadoTerritorio = { territorio_id: string; cadastros: number; cadastros_mes: number; apoiadores: number };

export default async function LiderancasPage() {
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

  const podeGerenciar = PAPEIS_QUE_GERENCIAM.has(eu.papel);
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const [{ data: liderancas }, { data: metas }, { data: territorios }, aggLid, aggTerr, aggCamp] =
    await Promise.all([
      supabase
        .from("liderancas")
        .select("id, nome, telefone, cidade, bairro, territorio_id, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("metas")
        .select("id, tipo, lideranca_id, territorio_id, periodo, alvo_cadastros, alvo_apoiadores, liderancas(nome), territorios(nome_bairro, cidade)")
        .order("created_at", { ascending: false }),
      supabase.from("territorios").select("id, nome_bairro, cidade").order("nome_bairro"),
      supabase.rpc("agregados_liderancas"),
      supabase.rpc("agregados_territorios"),
      supabase.rpc("agregados_campanha"),
    ]);

  const porLideranca = new Map<string, Agregado>(
    ((aggLid.data ?? []) as Agregado[]).map((a) => [a.lideranca_id, a])
  );
  const porTerritorio = new Map<string, AgregadoTerritorio>(
    ((aggTerr.data ?? []) as AgregadoTerritorio[]).map((a) => [a.territorio_id, a])
  );
  const campanhaAgg = (aggCamp.data?.[0] ?? {
    cadastros: 0,
    cadastros_mes: 0,
    apoiadores: 0,
    apoiadores_mes: 0,
    sem_coordenada: 0,
  }) as { cadastros: number; cadastros_mes: number; apoiadores: number; apoiadores_mes: number; sem_coordenada: number };

  // Meta de cada liderança (a mais recente do tipo lideranca) alimenta a coluna Meta/Progresso.
  const metaDaLideranca = new Map<string, { alvo: number; periodo: string }>();
  for (const m of metas ?? []) {
    if (m.tipo === "lideranca" && m.lideranca_id && !metaDaLideranca.has(m.lideranca_id)) {
      metaDaLideranca.set(m.lideranca_id, { alvo: m.alvo_cadastros, periodo: m.periodo });
    }
  }

  const linhas = (liderancas ?? []).map((l) => {
    const agg = porLideranca.get(l.id);
    const meta = metaDaLideranca.get(l.id);
    const cadastros = Number(agg?.cadastros ?? 0);
    const relevante = meta?.periodo === "mensal" ? Number(agg?.cadastros_mes ?? 0) : cadastros;
    return {
      id: l.id,
      nome: l.nome,
      telefone: l.telefone,
      cidade: l.cidade,
      bairro: l.bairro,
      territorioId: l.territorio_id,
      status: l.status,
      cadastros,
      metaAlvo: meta?.alvo ?? null,
      progressoPct: meta ? Math.round((relevante / meta.alvo) * 100) : null,
    };
  });

  const metasComProgresso = (metas ?? []).map((m) => {
    let cadastros = 0;
    let apoiadores = 0;
    if (m.tipo === "lideranca" && m.lideranca_id) {
      const a = porLideranca.get(m.lideranca_id);
      cadastros = Number(m.periodo === "mensal" ? a?.cadastros_mes ?? 0 : a?.cadastros ?? 0);
      apoiadores = Number(a?.apoiadores ?? 0);
    } else if (m.tipo === "territorio" && m.territorio_id) {
      const a = porTerritorio.get(m.territorio_id);
      cadastros = Number(m.periodo === "mensal" ? a?.cadastros_mes ?? 0 : a?.cadastros ?? 0);
      apoiadores = Number(a?.apoiadores ?? 0);
    } else {
      cadastros = Number(m.periodo === "mensal" ? campanhaAgg.cadastros_mes : campanhaAgg.cadastros);
      apoiadores = Number(m.periodo === "mensal" ? campanhaAgg.apoiadores_mes : campanhaAgg.apoiadores);
    }
    const liderancaRel = Array.isArray(m.liderancas) ? m.liderancas[0] : m.liderancas;
    const territorioRel = Array.isArray(m.territorios) ? m.territorios[0] : m.territorios;
    const titulo =
      m.tipo === "lideranca"
        ? `${liderancaRel?.nome ?? "Liderança"} (liderança)`
        : m.tipo === "territorio"
          ? `Território ${labelTerritorio(territorioRel?.nome_bairro, territorioRel?.cidade)}`
          : "Campanha geral";
    return {
      id: m.id,
      titulo,
      periodo: m.periodo,
      alvoCadastros: m.alvo_cadastros,
      alvoApoiadores: m.alvo_apoiadores,
      cadastros,
      apoiadores,
      pct: Math.min(100, Math.round((cadastros / m.alvo_cadastros) * 100)),
    };
  });

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Lideranças</h1>
          <p className="text-sm text-neutral-500">
            Rede de lideranças de campo com metas de cadastro. A liderança traz formulários
            preenchidos de eleitores; a coordenação digita e atribui a ela.
          </p>
        </div>

        {eu.papel === "coord_campanha" && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Territórios
            </h2>
            <p className="text-xs text-neutral-500">
              Cadastre os bairros/cidades de atuação antes de vincular lideranças e metas a eles.
            </p>
            <TerritorioForm campanhaId={eu.campanha_id} />
          </section>
        )}

        {podeGerenciar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Nova liderança
            </h2>
            <LiderancaForm campanhaId={eu.campanha_id} territorios={territorios ?? []} />
          </section>
        )}

        <section className="space-y-3">
          <LiderancasTable linhas={linhas} territorios={territorios ?? []} podeGerenciar={podeGerenciar} />
        </section>

        <section className="space-y-3 rounded border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Target size={14} strokeWidth={2} aria-hidden="true" />
                Metas da campanha
              </h2>
              <p className="text-xs text-neutral-500">
                Defina metas de cadastros por liderança, território ou campanha geral.
              </p>
            </div>
          </div>

          {podeGerenciar && (
            <MetaForm
              campanhaId={eu.campanha_id}
              liderancas={(liderancas ?? []).map((l) => ({ id: l.id, nome: l.nome }))}
              territorios={territorios ?? []}
            />
          )}

          {metasComProgresso.length === 0 && (
            <p className="text-sm text-neutral-400">Nenhuma meta definida ainda.</p>
          )}

          <ul className="space-y-2">
            {metasComProgresso.map((m) => (
              <li key={m.id} className="rounded border border-neutral-200 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{m.titulo}</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">
                      {m.pct}%
                    </span>
                    {podeGerenciar && <MetaDeleteButton metaId={m.id} />}
                  </div>
                </div>
                <p className="text-xs text-neutral-500">
                  Meta {m.periodo} · {m.cadastros}/{m.alvoCadastros} cadastros
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-neutral-900" style={{ width: `${m.pct}%` }} />
                </div>
                {m.alvoApoiadores && (
                  <p className="text-xs text-neutral-500">
                    Apoiadores: {m.apoiadores}/{m.alvoApoiadores} (
                    {Math.min(100, Math.round((m.apoiadores / m.alvoApoiadores) * 100))}%)
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
