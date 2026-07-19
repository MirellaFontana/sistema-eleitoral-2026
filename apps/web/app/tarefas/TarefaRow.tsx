"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUS_OPCOES = [
  { value: "a_fazer", label: "A fazer" },
  { value: "em_progresso", label: "Em progresso" },
  { value: "concluida", label: "Concluída" },
];

const STATUS_BADGE: Record<string, string> = {
  a_fazer: "bg-neutral-100 text-neutral-700",
  em_progresso: "bg-amber-100 text-amber-800",
  concluida: "bg-neutral-900 text-white",
};

type Tarefa = {
  id: string;
  titulo: string;
  responsavel: string;
  status: string;
  prazo: string | null;
};

export function TarefaRow({
  tarefa,
  podeEditar,
  podeExcluir,
}: {
  tarefa: Tarefa;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [carregando, setCarregando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function mudarStatus(novo: string) {
    setCarregando(true);
    await supabase.from("tarefas").update({ status: novo }).eq("id", tarefa.id);
    setCarregando(false);
    router.refresh();
  }

  async function excluir() {
    setCarregando(true);
    await supabase.from("tarefas").delete().eq("id", tarefa.id);
    setCarregando(false);
    setConfirmando(false);
    router.refresh();
  }

  const label = STATUS_OPCOES.find((s) => s.value === tarefa.status)?.label ?? tarefa.status;

  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="px-3 py-2 font-medium">{tarefa.titulo}</td>
      <td className="px-3 py-2 text-neutral-600">{tarefa.responsavel}</td>
      <td className="px-3 py-2">
        {podeEditar ? (
          <select
            value={tarefa.status}
            disabled={carregando}
            onChange={(e) => mudarStatus(e.target.value)}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[tarefa.status] ?? ""}`}
          >
            {STATUS_OPCOES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        ) : (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[tarefa.status] ?? ""}`}>
            {label}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-neutral-600">
        {tarefa.prazo ? new Date(tarefa.prazo + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
      </td>
      {podeExcluir && (
        <td className="px-3 py-2 text-right">
          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              title="Excluir tarefa"
              className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              🗑️
            </button>
          ) : (
            <span className="flex items-center justify-end gap-1">
              <button
                onClick={excluir}
                disabled={carregando}
                className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {carregando ? "…" : "Excluir"}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100"
              >
                Cancelar
              </button>
            </span>
          )}
        </td>
      )}
    </tr>
  );
}
