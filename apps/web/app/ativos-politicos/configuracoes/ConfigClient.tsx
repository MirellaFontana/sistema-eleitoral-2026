"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Categoria = { id: string; nome: string; grupo: string; cor: string | null; icone: string | null; ativo: boolean; ordem: number };
type TipoRel = { id: string; nome: string; direcional: boolean };

const GRUPOS_LABEL: Record<string, string> = {
  liderancas: "Lideranças",
  executivo: "Poder Executivo",
  legislativo: "Poder Legislativo",
  partidario: "Estrutura Partidária",
  sociedade: "Sociedade Organizada",
  outros: "Outros",
};

export function ConfigClient({
  categorias,
  tiposRelacionamento,
  campanhaId,
}: {
  categorias: Categoria[];
  tiposRelacionamento: TipoRel[];
  campanhaId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [novaCat, setNovaCat] = useState({ nome: "", grupo: "outros" });
  const [novoTipo, setNovoTipo] = useState({ nome: "", direcional: true });
  const [salvando, setSalvando] = useState(false);

  const supabase = createClient();

  async function addCategoria(e: React.FormEvent) {
    e.preventDefault();
    if (!novaCat.nome.trim()) return;
    setSalvando(true);
    const maxOrdem = Math.max(0, ...categorias.map((c) => c.ordem));
    await supabase.from("categorias_ativo_politico").insert({
      campanha_id: campanhaId,
      nome: novaCat.nome.trim(),
      grupo: novaCat.grupo,
      ordem: maxOrdem + 1,
    });
    setNovaCat({ nome: "", grupo: "outros" });
    setSalvando(false);
    startTransition(() => router.refresh());
  }

  async function toggleCategoria(id: string, ativo: boolean) {
    await supabase.from("categorias_ativo_politico").update({ ativo: !ativo }).eq("id", id);
    startTransition(() => router.refresh());
  }

  async function deleteCategoria(id: string) {
    await supabase.from("categorias_ativo_politico").delete().eq("id", id);
    startTransition(() => router.refresh());
  }

  async function addTipoRel(e: React.FormEvent) {
    e.preventDefault();
    if (!novoTipo.nome.trim()) return;
    setSalvando(true);
    await supabase.from("tipos_relacionamento_ativo").insert({
      campanha_id: campanhaId,
      nome: novoTipo.nome.trim(),
      direcional: novoTipo.direcional,
    });
    setNovoTipo({ nome: "", direcional: true });
    setSalvando(false);
    startTransition(() => router.refresh());
  }

  async function deleteTipoRel(id: string) {
    await supabase.from("tipos_relacionamento_ativo").delete().eq("id", id);
    startTransition(() => router.refresh());
  }

  const catsPorGrupo = categorias.reduce<Record<string, Categoria[]>>((acc, c) => {
    (acc[c.grupo] ??= []).push(c);
    return acc;
  }, {});

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8">
      <div>
        <h1 className="text-lg font-semibold">Configurações — Ativos Políticos</h1>
        <p className="text-sm text-neutral-500">Gerencie categorias e tipos de relacionamento.</p>
      </div>

      {/* Categorias */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Categorias de ativo ({categorias.length})
        </h2>

        {Object.entries(catsPorGrupo).map(([grupo, cats]) => (
          <div key={grupo} className="space-y-1">
            <h3 className="text-xs font-medium text-neutral-400">{GRUPOS_LABEL[grupo] ?? grupo}</h3>
            <ul className="space-y-1">
              {cats.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded border border-neutral-100 px-3 py-1.5 text-sm">
                  <span className={c.ativo ? "" : "text-neutral-400 line-through"}>{c.nome}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCategoria(c.id, c.ativo)}
                      className="text-xs text-neutral-500 hover:text-neutral-700"
                    >
                      {c.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => deleteCategoria(c.id)}
                      className="text-neutral-400 hover:text-rose-600"
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <form onSubmit={addCategoria} className="flex items-end gap-2">
          <label className="flex-1 space-y-1">
            <span className="text-xs font-medium text-neutral-500">Nova categoria</span>
            <input
              value={novaCat.nome}
              onChange={(e) => setNovaCat({ ...novaCat, nome: e.target.value })}
              placeholder="Nome da categoria"
              className="w-full rounded border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral-500">Grupo</span>
            <select
              value={novaCat.grupo}
              onChange={(e) => setNovaCat({ ...novaCat, grupo: e.target.value })}
              className="rounded border px-2.5 py-1.5 text-sm"
            >
              {Object.entries(GRUPOS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={salvando || !novaCat.nome.trim()}
            className="inline-flex items-center gap-1 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            <Plus size={14} /> Adicionar
          </button>
        </form>
      </section>

      {/* Tipos de relacionamento */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Tipos de relacionamento ({tiposRelacionamento.length})
        </h2>

        <ul className="space-y-1">
          {tiposRelacionamento.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded border border-neutral-100 px-3 py-1.5 text-sm">
              <span>
                {t.nome}
                <span className="ml-2 text-xs text-neutral-400">
                  {t.direcional ? "(direcional: A → B)" : "(bidirecional: A ↔ B)"}
                </span>
              </span>
              <button
                onClick={() => deleteTipoRel(t.id)}
                className="text-neutral-400 hover:text-rose-600"
                title="Excluir"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={addTipoRel} className="flex items-end gap-2">
          <label className="flex-1 space-y-1">
            <span className="text-xs font-medium text-neutral-500">Novo tipo</span>
            <input
              value={novoTipo.nome}
              onChange={(e) => setNovoTipo({ ...novoTipo, nome: e.target.value })}
              placeholder="Ex: É aliado de"
              className="w-full rounded border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              checked={novoTipo.direcional}
              onChange={(e) => setNovoTipo({ ...novoTipo, direcional: e.target.checked })}
              className="rounded"
            />
            <span className="text-xs text-neutral-500">Direcional</span>
          </label>
          <button
            type="submit"
            disabled={salvando || !novoTipo.nome.trim()}
            className="inline-flex items-center gap-1 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            <Plus size={14} /> Adicionar
          </button>
        </form>
      </section>
    </main>
  );
}
