"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MembroEquipe = { id: string; nome: string };

export function TarefaForm({
  campanhaId,
  equipe,
}: {
  campanhaId: string;
  equipe: MembroEquipe[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
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
      descricao: descricao.trim() || null,
      responsavel_id: responsavelId || null,
      prazo: prazo || null,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso("Tarefa criada.");
    setTitulo("");
    setDescricao("");
    setResponsavelId("");
    setPrazo("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Título</label>
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Descrição <span className="font-normal text-neutral-400">(opcional)</span>
        </label>
        <textarea
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes do que precisa ser feito, contexto, links..."
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Responsável</label>
          <select
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">Ninguém atribuído ainda</option>
            {equipe.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Prazo (opcional)</label>
          <input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Criando…" : "Criar tarefa"}
      </button>
    </form>
  );
}
