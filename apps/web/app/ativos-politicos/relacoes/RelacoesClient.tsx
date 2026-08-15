"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, GitFork, List } from "lucide-react";

type TipoRel = { id: string; nome: string; direcional: boolean };
type AtivoRef = { id: string; nome: string };
type Relacionamento = {
  id: string;
  observacoes: string | null;
  created_at: string;
  tipos_relacionamento_ativo: { nome: string; direcional: boolean } | { nome: string; direcional: boolean }[] | null;
  origem: { id: string; nome: string; cargo_atual: string | null } | { id: string; nome: string; cargo_atual: string | null }[] | null;
  destino: { id: string; nome: string; cargo_atual: string | null } | { id: string; nome: string; cargo_atual: string | null }[] | null;
};

function unwrap<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function RelacoesClient({
  relacionamentos,
  total,
  tiposRelacionamento,
  ativos,
  podeGerenciar,
}: {
  relacionamentos: Relacionamento[];
  total: number;
  tiposRelacionamento: TipoRel[];
  ativos: AtivoRef[];
  podeGerenciar: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [visao, setVisao] = useState<"tabela" | "grafo">("tabela");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const grafoData = useMemo(() => {
    const nodes = new Map<string, { id: string; nome: string; cargo: string | null }>();
    const edges: { from: string; to: string; tipo: string; direcional: boolean }[] = [];

    for (const r of relacionamentos) {
      const origem = unwrap(r.origem);
      const destino = unwrap(r.destino);
      const tipo = unwrap(r.tipos_relacionamento_ativo);
      if (origem) nodes.set(origem.id, { id: origem.id, nome: origem.nome, cargo: origem.cargo_atual });
      if (destino) nodes.set(destino.id, { id: destino.id, nome: destino.nome, cargo: destino.cargo_atual });
      if (origem && destino) {
        edges.push({ from: origem.id, to: destino.id, tipo: tipo?.nome ?? "", direcional: tipo?.direcional ?? true });
      }
    }

    return { nodes: Array.from(nodes.values()), edges };
  }, [relacionamentos]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      ativo_origem_id: fd.get("origem"),
      ativo_destino_id: fd.get("destino"),
      tipo_id: fd.get("tipo_id"),
      observacoes: fd.get("observacoes") || null,
    };

    if (body.ativo_origem_id === body.ativo_destino_id) {
      setErro("Origem e destino devem ser diferentes.");
      setSalvando(false);
      return;
    }

    const res = await fetch("/api/ativos-politicos/relacionamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.error ?? "Erro ao criar relacionamento.");
      setSalvando(false);
      return;
    }

    setSalvando(false);
    setMostrarForm(false);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    await fetch(`/api/ativos-politicos/relacionamentos?id=${id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Relações entre Ativos</h1>
          <p className="text-sm text-neutral-500">{total} relacionamento(s) registrado(s)</p>
        </div>
        <div className="flex gap-2">
          {relacionamentos.length > 0 && (
            <button
              onClick={() => setVisao(visao === "tabela" ? "grafo" : "tabela")}
              className="inline-flex items-center gap-1.5 rounded border px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              {visao === "tabela" ? <><GitFork size={14} /> Grafo</> : <><List size={14} /> Tabela</>}
            </button>
          )}
          {podeGerenciar && (
            <button
              onClick={() => setMostrarForm(!mostrarForm)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              {mostrarForm ? <X size={14} /> : <Plus size={14} />}
              {mostrarForm ? "Cancelar" : "Nova relação"}
            </button>
          )}
        </div>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-neutral-200 p-4 space-y-4">
          {erro && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">De (origem) *</span>
              <select name="origem" required className="w-full rounded border px-2.5 py-1.5 text-sm">
                <option value="">Selecione</option>
                {ativos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Para (destino) *</span>
              <select name="destino" required className="w-full rounded border px-2.5 py-1.5 text-sm">
                <option value="">Selecione</option>
                {ativos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Tipo de relação *</span>
              <select name="tipo_id" required className="w-full rounded border px-2.5 py-1.5 text-sm">
                <option value="">Selecione</option>
                {tiposRelacionamento.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} {t.direcional ? "(→)" : "(↔)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Observações</span>
              <input name="observacoes" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Criar relação"}
          </button>
        </form>
      )}

      {relacionamentos.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">Nenhum relacionamento registrado.</p>
      ) : visao === "grafo" ? (
        <GrafoRelacoes nodes={grafoData.nodes} edges={grafoData.edges} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                <th className="pb-2 pr-3">Origem</th>
                <th className="pb-2 pr-3">Relação</th>
                <th className="pb-2 pr-3">Destino</th>
                <th className="pb-2 pr-3">Obs.</th>
                {podeGerenciar && <th className="pb-2 pr-3 w-10" />}
              </tr>
            </thead>
            <tbody>
              {relacionamentos.map((r) => {
                const tipo = unwrap(r.tipos_relacionamento_ativo);
                const origem = unwrap(r.origem);
                const destino = unwrap(r.destino);
                return (
                  <tr key={r.id} className="border-b border-neutral-100">
                    <td className="py-2 pr-3">
                      {origem ? (
                        <Link href={`/ativos-politicos/${origem.id}`} className="font-medium text-indigo-600 hover:underline">
                          {origem.nome}
                        </Link>
                      ) : "—"}
                      {origem?.cargo_atual && <span className="ml-1 text-xs text-neutral-400">({origem.cargo_atual})</span>}
                    </td>
                    <td className="py-2 pr-3 text-neutral-500">
                      {tipo?.nome ?? "—"} {tipo?.direcional ? "→" : "↔"}
                    </td>
                    <td className="py-2 pr-3">
                      {destino ? (
                        <Link href={`/ativos-politicos/${destino.id}`} className="font-medium text-indigo-600 hover:underline">
                          {destino.nome}
                        </Link>
                      ) : "—"}
                      {destino?.cargo_atual && <span className="ml-1 text-xs text-neutral-400">({destino.cargo_atual})</span>}
                    </td>
                    <td className="py-2 pr-3 text-xs text-neutral-400">{r.observacoes ?? "—"}</td>
                    {podeGerenciar && (
                      <td className="py-2 pr-3">
                        <button onClick={() => handleDelete(r.id)} className="text-neutral-400 hover:text-rose-600" title="Excluir">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function GrafoRelacoes({
  nodes,
  edges,
}: {
  nodes: { id: string; nome: string; cargo: string | null }[];
  edges: { from: string; to: string; tipo: string; direcional: boolean }[];
}) {
  if (nodes.length === 0) return null;

  const W = 800;
  const H = 500;
  const CX = W / 2;
  const CY = H / 2;
  const R = Math.min(W, H) * 0.35;

  const posMap = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    posMap.set(n.id, { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) });
  });

  const connectionCount = new Map<string, number>();
  for (const e of edges) {
    connectionCount.set(e.from, (connectionCount.get(e.from) ?? 0) + 1);
    connectionCount.set(e.to, (connectionCount.get(e.to) ?? 0) + 1);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 500 }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const from = posMap.get(e.from);
          const to = posMap.get(e.to);
          if (!from || !to) return null;
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          return (
            <g key={i}>
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke="#cbd5e1" strokeWidth={1.5}
                markerEnd={e.direcional ? "url(#arrowhead)" : undefined}
              />
              {e.tipo && (
                <text x={mx} y={my - 6} textAnchor="middle" fontSize={9} fill="#94a3b8">
                  {e.tipo}
                </text>
              )}
            </g>
          );
        })}

        {nodes.map((n) => {
          const pos = posMap.get(n.id)!;
          const count = connectionCount.get(n.id) ?? 1;
          const radius = Math.min(28, 14 + count * 3);
          return (
            <g key={n.id}>
              <a href={`/ativos-politicos/${n.id}`}>
                <circle cx={pos.x} cy={pos.y} r={radius} fill="#e0e7ff" stroke="#6366f1" strokeWidth={1.5} className="hover:fill-indigo-200 cursor-pointer" />
                <text x={pos.x} y={pos.y + radius + 14} textAnchor="middle" fontSize={11} fontWeight={500} fill="#334155">
                  {n.nome.length > 20 ? n.nome.slice(0, 18) + "…" : n.nome}
                </text>
                {n.cargo && (
                  <text x={pos.x} y={pos.y + radius + 26} textAnchor="middle" fontSize={9} fill="#94a3b8">
                    {n.cargo.length > 25 ? n.cargo.slice(0, 23) + "…" : n.cargo}
                  </text>
                )}
              </a>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
