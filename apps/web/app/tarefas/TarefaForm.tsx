"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function TarefaForm({ campanhaId }: { campanhaId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [titulo, setTitulo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const { error } = await supabase.from("tarefas").insert({
      campanha_id: campanhaId,
      titulo: titulo.trim(),
      responsavel: responsavel.trim(),
      prazo: prazo || null,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso("Tarefa criada.");
    setTitulo("");
    setResponsavel("");
    setPrazo("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded border border-neutral-200 p-4">
      <div className="min-w-64 flex-1 space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Título</label>
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Responsável</label>
        <input
          required
          placeholder="ex.: Equipe campo"
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Prazo (opcional)</label>
        <input
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {carregando ? "Criando…" : "+ Nova tarefa"}
      </button>
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="w-full text-sm text-green-700">{sucesso}</p>}
    </form>
  );
}
