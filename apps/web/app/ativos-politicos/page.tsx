import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, MapPin, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";

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

const NIVEL_LABELS: Record<string, string> = {
  muito_alto: "Muito alto",
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
  nao_avaliado: "Não avaliado",
};

const STATUS_LABELS: Record<string, string> = {
  nao_relacionado: "Não relacionado",
  identificado: "Identificado",
  contato_realizado: "Contato realizado",
  relacionamento_ativo: "Relacionamento ativo",
  parceiro: "Parceiro",
  em_avaliacao: "Em avaliação",
  inativo: "Inativo",
};

const STATUS_CORES: Record<string, string> = {
  nao_relacionado: "bg-neutral-200",
  identificado: "bg-sky-200",
  contato_realizado: "bg-amber-200",
  relacionamento_ativo: "bg-emerald-200",
  parceiro: "bg-indigo-200",
  em_avaliacao: "bg-orange-200",
  inativo: "bg-neutral-300",
};

export default async function AtivosPoliticosPage() {
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

  const [
    { count: total },
    { count: geolocalizados },
    { data: ativos },
    { data: recentes },
  ] = await Promise.all([
    supabase.from("ativos_politicos").select("id", { count: "exact", head: true }),
    supabase.from("ativos_politicos").select("id", { count: "exact", head: true }).not("geolocalizacao", "is", null),
    supabase
      .from("ativos_politicos")
      .select("nivel_influencia, status_campanha, partido, categoria_id, categorias_ativo_politico(nome, grupo)"),
    supabase
      .from("ativos_politicos")
      .select("id, nome, cidade, cargo_atual, partido, status_campanha, categorias_ativo_politico(nome)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const totalNum = total ?? 0;
  const geoNum = geolocalizados ?? 0;

  const categoriaCounts: Record<string, number> = {};
  const nivelCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const partidoCounts: Record<string, number> = {};

  for (const a of ativos ?? []) {
    const cat = (Array.isArray(a.categorias_ativo_politico) ? a.categorias_ativo_politico[0] : a.categorias_ativo_politico) as { nome: string; grupo: string } | null;
    const catNome = cat?.nome ?? "Sem categoria";
    categoriaCounts[catNome] = (categoriaCounts[catNome] ?? 0) + 1;
    nivelCounts[a.nivel_influencia] = (nivelCounts[a.nivel_influencia] ?? 0) + 1;
    statusCounts[a.status_campanha] = (statusCounts[a.status_campanha] ?? 0) + 1;
    if (a.partido) partidoCounts[a.partido] = (partidoCounts[a.partido] ?? 0) + 1;
  }

  const topCategorias = Object.entries(categoriaCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topPartidos = Object.entries(partidoCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Ativos Políticos</h1>
            <p className="text-sm text-neutral-500">
              Rede de poder político territorial da campanha.
            </p>
          </div>
          <Link
            href="/ativos-politicos/lista"
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Ver todos
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Cards principais */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-2 text-neutral-500">
              <Users size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">Ativos Políticos</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{totalNum.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-2 text-neutral-500">
              <MapPin size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">Geolocalizados</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{geoNum.toLocaleString("pt-BR")}</p>
            {totalNum > 0 && (
              <p className="text-xs text-neutral-400">{Math.round((geoNum / totalNum) * 100)}% do total</p>
            )}
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Categorias</span>
            <p className="mt-1 text-2xl font-bold">{Object.keys(categoriaCounts).length}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Partidos</span>
            <p className="mt-1 text-2xl font-bold">{Object.keys(partidoCounts).length}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Por status de relacionamento */}
          <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Relacionamento com a campanha
            </h2>
            {Object.entries(statusCounts).length === 0 && (
              <p className="text-sm text-neutral-400">Nenhum ativo cadastrado.</p>
            )}
            <ul className="space-y-2">
              {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([key, qtd]) => (
                <li key={key} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_CORES[key] ?? "bg-neutral-200"}`} />
                    {STATUS_LABELS[key] ?? key}
                  </span>
                  <span className="font-medium">{qtd}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Por nível de influência */}
          <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Nível de influência
            </h2>
            {Object.entries(nivelCounts).length === 0 && (
              <p className="text-sm text-neutral-400">Nenhum ativo cadastrado.</p>
            )}
            <ul className="space-y-2">
              {Object.entries(nivelCounts).sort((a, b) => b[1] - a[1]).map(([key, qtd]) => (
                <li key={key} className="flex items-center justify-between text-sm">
                  <span>{NIVEL_LABELS[key] ?? key}</span>
                  <span className="font-medium">{qtd}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Top categorias */}
          <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Por categoria (top 10)
            </h2>
            {topCategorias.length === 0 && (
              <p className="text-sm text-neutral-400">Nenhum ativo cadastrado.</p>
            )}
            <ul className="space-y-2">
              {topCategorias.map(([nome, qtd]) => (
                <li key={nome} className="flex items-center justify-between text-sm">
                  <span className="truncate">{nome}</span>
                  <span className="ml-2 font-medium">{qtd}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Top partidos */}
          <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Por partido (top 10)
            </h2>
            {topPartidos.length === 0 && (
              <p className="text-sm text-neutral-400">Nenhum partido registrado.</p>
            )}
            <ul className="space-y-2">
              {topPartidos.map(([nome, qtd]) => (
                <li key={nome} className="flex items-center justify-between text-sm">
                  <span className="truncate">{nome}</span>
                  <span className="ml-2 font-medium">{qtd}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Últimos cadastrados */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Últimos cadastrados
            </h2>
            <Link href="/ativos-politicos/lista" className="text-xs text-indigo-600 hover:underline">
              Ver todos
            </Link>
          </div>
          {(recentes ?? []).length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum ativo cadastrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                    <th className="pb-2 pr-4">Nome</th>
                    <th className="pb-2 pr-4">Cargo</th>
                    <th className="pb-2 pr-4">Cidade</th>
                    <th className="pb-2 pr-4">Partido</th>
                    <th className="pb-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentes ?? []).map((r) => {
                    const cat = (Array.isArray(r.categorias_ativo_politico) ? r.categorias_ativo_politico[0] : r.categorias_ativo_politico) as { nome: string } | null;
                    return (
                      <tr key={r.id} className="border-b border-neutral-100">
                        <td className="py-2 pr-4">
                          <Link href={`/ativos-politicos/${r.id}`} className="font-medium text-indigo-600 hover:underline">
                            {r.nome}
                          </Link>
                          {cat && <span className="ml-1.5 text-xs text-neutral-400">{cat.nome}</span>}
                        </td>
                        <td className="py-2 pr-4 text-neutral-600">{r.cargo_atual ?? "—"}</td>
                        <td className="py-2 pr-4 text-neutral-600">{r.cidade ?? "—"}</td>
                        <td className="py-2 pr-4 text-neutral-600">{r.partido ?? "—"}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CORES[r.status_campanha] ?? "bg-neutral-200"}`}>
                            {STATUS_LABELS[r.status_campanha] ?? r.status_campanha}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
