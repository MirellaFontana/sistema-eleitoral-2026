"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  Ban,
  Send,
} from "lucide-react";

type Proposta = {
  id: string;
  titulo: string;
  descricao: string;
  tema: string | null;
  territorio: string | null;
  publico_alvo: string | null;
  status: "rascunho" | "em_revisao" | "aprovada" | "descartada";
  fundamentacao: string | null;
  impacto_estimado: string | null;
  custo_estimado: string | null;
  prazo: string | null;
  created_at: string;
  usuarios_internos: { nome: string } | null;
};

const STATUS_BADGE: Record<string, string> = {
  rascunho: "bg-neutral-100 text-neutral-600",
  em_revisao: "bg-amber-100 text-amber-700",
  aprovada: "bg-green-100 text-green-700",
  descartada: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  descartada: "Descartada",
};

const FILTROS = ["todos", "rascunho", "em_revisao", "aprovada", "descartada"] as const;

export function PropostasClient({
  podeCriar,
  podeAprovar,
}: {
  podeCriar: boolean;
  podeAprovar: boolean;
}) {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>("todos");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const params = filtro !== "todos" ? `?status=${filtro}` : "";
    const res = await fetch(`/api/propostas${params}`);
    const json = await res.json();
    setPropostas(json.propostas ?? []);
    setLoading(false);
  }, [filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  async function atualizarStatus(id: string, status: string) {
    await fetch("/api/propostas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    carregar();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Propostas</h1>
          <p className="text-sm text-neutral-500">Propostas da campanha por tema</p>
        </div>
        {podeCriar && (
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {mostrarForm ? <X size={16} /> : <Plus size={16} />}
            {mostrarForm ? "Cancelar" : "Nova proposta"}
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filtro === f
                ? "bg-indigo-600 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {f === "todos" ? "Todos" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {mostrarForm && (
        <NovaPropostaForm onSalva={() => { setMostrarForm(false); carregar(); }} />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-neutral-100" />)}
        </div>
      ) : propostas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">
          <FileText size={32} className="mx-auto mb-2 text-neutral-300" />
          Nenhuma proposta encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          {propostas.map((p) => (
            <div key={p.id} className="rounded-lg border border-neutral-200 bg-white">
              <button
                onClick={() => setExpandido(expandido === p.id ? null : p.id)}
                className="flex w-full items-start gap-3 p-3 text-left"
              >
                <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900">{p.titulo}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                    {p.tema && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">{p.tema}</span>}
                    {p.territorio && <span>{p.territorio}</span>}
                    <span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                    <span>{p.usuarios_internos?.nome}</span>
                  </div>
                </div>
                {expandido === p.id ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
              </button>

              {expandido === p.id && (
                <div className="space-y-3 border-t border-neutral-100 px-3 pb-3 pt-2">
                  <p className="text-sm text-neutral-700">{p.descricao}</p>

                  {p.fundamentacao && (
                    <div>
                      <p className="text-xs font-medium text-neutral-500">Fundamentação</p>
                      <p className="text-sm text-neutral-600">{p.fundamentacao}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm">
                    {p.publico_alvo && (
                      <div><span className="text-xs font-medium text-neutral-500">Público-alvo:</span> <span className="text-neutral-600">{p.publico_alvo}</span></div>
                    )}
                    {p.impacto_estimado && (
                      <div><span className="text-xs font-medium text-neutral-500">Impacto:</span> <span className="text-neutral-600">{p.impacto_estimado}</span></div>
                    )}
                    {p.custo_estimado && (
                      <div><span className="text-xs font-medium text-neutral-500">Custo:</span> <span className="text-neutral-600">{p.custo_estimado}</span></div>
                    )}
                    {p.prazo && (
                      <div><span className="text-xs font-medium text-neutral-500">Prazo:</span> <span className="text-neutral-600">{p.prazo}</span></div>
                    )}
                  </div>

                  {podeAprovar && (p.status === "rascunho" || p.status === "em_revisao") && (
                    <div className="flex gap-2 pt-1">
                      {p.status === "rascunho" && (
                        <button
                          onClick={() => atualizarStatus(p.id, "em_revisao")}
                          className="flex items-center gap-1 rounded bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600"
                        >
                          <Send size={12} /> Enviar p/ revisão
                        </button>
                      )}
                      <button
                        onClick={() => atualizarStatus(p.id, "aprovada")}
                        className="flex items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                      >
                        <Check size={12} /> Aprovar
                      </button>
                      <button
                        onClick={() => atualizarStatus(p.id, "descartada")}
                        className="flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                      >
                        <Ban size={12} /> Descartar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NovaPropostaForm({ onSalva }: { onSalva: () => void }) {
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      titulo: fd.get("titulo"),
      descricao: fd.get("descricao"),
      tema: fd.get("tema") || null,
      territorio: fd.get("territorio") || null,
      publico_alvo: fd.get("publico_alvo") || null,
      fundamentacao: fd.get("fundamentacao") || null,
      impacto_estimado: fd.get("impacto_estimado") || null,
      custo_estimado: fd.get("custo_estimado") || null,
      prazo: fd.get("prazo") || null,
    };
    const res = await fetch("/api/propostas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSalvando(false);
    if (res.ok) onSalva();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
      <p className="text-sm font-semibold text-indigo-900">Nova proposta</p>

      <label className="block text-sm">
        <span className="text-neutral-600">Título *</span>
        <input name="titulo" required className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </label>

      <label className="block text-sm">
        <span className="text-neutral-600">Descrição *</span>
        <textarea name="descricao" required rows={3} className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-neutral-600">Tema</span>
          <input name="tema" placeholder="Ex: saúde, educação" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-600">Território</span>
          <input name="territorio" placeholder="Ex: zona norte, interior" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-neutral-600">Público-alvo</span>
        <input name="publico_alvo" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </label>

      <label className="block text-sm">
        <span className="text-neutral-600">Fundamentação</span>
        <textarea name="fundamentacao" rows={2} className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-neutral-600">Impacto estimado</span>
          <input name="impacto_estimado" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-600">Custo estimado</span>
          <input name="custo_estimado" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-600">Prazo</span>
          <input name="prazo" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
      </div>

      <button
        type="submit"
        disabled={salvando}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Criar proposta"}
      </button>
    </form>
  );
}
