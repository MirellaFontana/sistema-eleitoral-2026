"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

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
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
