"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function FuncaoForm() {
  const router = useRouter();
  const supabase = createClient();

  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const n = nome.trim();
    if (!n) return;

    setCarregando(true);
    const { error } = await supabase
      .from("funcoes_campanha")
      .insert({ nome: n, descricao: descricao.trim() || null });

    setCarregando(false);
    if (error) {
      if (error.code === "23505") {
        setErro("Já existe uma função com esse nome.");
      } else {
        setErro(error.message);
      }
      return;
    }

    setNome("");
    setDescricao("");
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        <Plus size={14} strokeWidth={2} aria-hidden="true" />
        Nova função
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-neutral-600">Nome da função</label>
          <input
            autoFocus
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Assessor de imprensa"
            className="mt-1 w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600">Descrição (opcional)</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Atende imprensa e gerencia peças"
            className="mt-1 w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!nome.trim() || carregando}
          className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          {carregando ? "Criando…" : "Criar função"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setErro(null);
          }}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
