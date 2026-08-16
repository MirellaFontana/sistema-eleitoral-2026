"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type Simulacao = Record<string, unknown>;

const CARGO_LABELS: Record<string, string> = {
  deputado_federal: "Dep. Federal",
  deputado_estadual: "Dep. Estadual",
  deputado_distrital: "Dep. Distrital",
  vereador: "Vereador",
};

const STATUS_COR: Record<string, string> = {
  ELEITO: "bg-emerald-100 text-emerald-800",
  SUPLENTE: "bg-amber-100 text-amber-800",
  "ABAIXO DO MINIMO": "bg-red-100 text-red-800",
};

export function HistoricoClient({ simulacoes }: { simulacoes: Simulacao[] }) {
  const [expandida, setExpandida] = useState<string | null>(null);
  const [comparar, setComparar] = useState<[string, string] | null>(null);
  const [selComparar, setSelComparar] = useState<string[]>([]);

  function toggleExpandir(id: string) {
    setExpandida(expandida === id ? null : id);
  }

  function toggleSelComparar(id: string) {
    setSelComparar((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function executarComparacao() {
    if (selComparar.length === 2) {
      setComparar([selComparar[0], selComparar[1]]);
    }
  }

  function formatarData(d: string) {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (simulacoes.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-lg font-semibold text-neutral-800">Histórico de Simulações</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Nenhuma simulação salva. Use o <a href="/chapas-proporcionais/simulador" className="text-teal-600 hover:underline">Simulador</a> para criar uma.
        </p>
      </main>
    );
  }

  const sim1 = comparar ? simulacoes.find((s) => s.id === comparar[0]) : null;
  const sim2 = comparar ? simulacoes.find((s) => s.id === comparar[1]) : null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-800">Histórico de Simulações</h1>
          <p className="text-sm text-neutral-500">{simulacoes.length} simulação(ões) salva(s).</p>
        </div>
        <div className="flex items-center gap-2">
          {selComparar.length === 2 && (
            <button onClick={executarComparacao} className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
              Comparar selecionadas
            </button>
          )}
          {!!comparar && (
            <button onClick={() => { setComparar(null); setSelComparar([]); }} className="rounded border px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
              Fechar comparação
            </button>
          )}
        </div>
      </div>

      {!!comparar && sim1 && sim2 && (
        <div className="rounded-lg border border-neutral-200 p-4 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Comparação</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[sim1, sim2].map((sim) => {
              const res = sim.resultado as Record<string, unknown> | null;
              const partidos = (res?.partidos ?? []) as Record<string, unknown>[];
              const eleicao = sim.eleicoes_proporcionais as Record<string, unknown> | null;
              return (
                <div key={sim.id as string} className="rounded border border-neutral-200 p-3 space-y-2">
                  <h3 className="text-sm font-semibold">{sim.titulo as string}</h3>
                  <p className="text-xs text-neutral-500">
                    {!!eleicao && `${CARGO_LABELS[eleicao.cargo as string] ?? eleicao.cargo} - ${eleicao.estado}`}
                    {" | "}QE: {(res?.qe as number)?.toLocaleString("pt-BR") ?? "—"}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left font-medium uppercase tracking-wide text-neutral-400">
                          <th className="pb-1 pr-2">Partido</th>
                          <th className="pb-1 pr-2">Cadeiras</th>
                          <th className="pb-1 pr-2">Votos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partidos.map((p) => (
                          <tr key={p.partido as string} className="border-t border-neutral-100">
                            <td className="py-1 pr-2 font-medium">{p.partido as string}</td>
                            <td className="py-1 pr-2">{p.cadeirasTotal as number}</td>
                            <td className="py-1 pr-2">{(p.votosTotal as number)?.toLocaleString("pt-BR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {simulacoes.map((sim) => {
          const simId = sim.id as string;
          const isExpanded = expandida === simId;
          const res = sim.resultado as Record<string, unknown> | null;
          const partidos = (res?.partidos ?? []) as Record<string, unknown>[];
          const eleicao = sim.eleicoes_proporcionais as Record<string, unknown> | null;
          const isSelected = selComparar.includes(simId);

          return (
            <div key={simId} className="rounded-lg border border-neutral-200">
              <div className="flex items-center gap-3 p-4">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelComparar(simId)}
                  className="shrink-0"
                  title="Selecionar para comparação"
                />
                <button
                  onClick={() => toggleExpandir(simId)}
                  className="flex flex-1 items-center justify-between text-left hover:bg-neutral-50"
                >
                  <div>
                    <span className="text-sm font-semibold text-neutral-800">{sim.titulo as string}</span>
                    {!!(sim.cenario) && (
                      <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{sim.cenario as string}</span>
                    )}
                    <p className="text-xs text-neutral-400">
                      {!!eleicao && `${CARGO_LABELS[eleicao.cargo as string] ?? eleicao.cargo} - ${eleicao.estado}`}
                      {" | "}{formatarData(sim.created_at as string)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">QE: {(res?.qe as number)?.toLocaleString("pt-BR") ?? "—"}</span>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>
              </div>

              {isExpanded && !!res && (
                <div className="border-t border-neutral-100 p-4 space-y-4">
                  <div className="flex gap-4 text-xs text-neutral-500">
                    <span>Votos válidos: {(res.votosValidos as number)?.toLocaleString("pt-BR")}</span>
                    <span>QE: {(res.qe as number)?.toLocaleString("pt-BR")}</span>
                  </div>

                  {partidos.map((p) => {
                    const cands = (p.candidatos ?? []) as Record<string, unknown>[];
                    return (
                      <div key={p.partido as string} className="space-y-1">
                        <h4 className="text-sm font-semibold">
                          {p.partido as string} — {p.cadeirasTotal as number} cadeira{(p.cadeirasTotal as number) !== 1 ? "s" : ""}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <tbody>
                              {cands.map((c, i) => (
                                <tr key={i} className="border-t border-neutral-100">
                                  <td className="py-1 pr-3">{c.nome_urna as string}</td>
                                  <td className="py-1 pr-3">{(c.votos as number)?.toLocaleString("pt-BR")}</td>
                                  <td className="py-1 pr-3">
                                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COR[c.status as string] ?? "bg-neutral-100"}`}>
                                      {c.status as string}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
