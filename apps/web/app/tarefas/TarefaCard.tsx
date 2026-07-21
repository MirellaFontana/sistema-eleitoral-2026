"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MembroEquipe = { id: string; nome: string };

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

export type TarefaView = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prazo: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  createdAt: string;
};

function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

export function TarefaCard({
  tarefa,
  equipe,
  podeEditar,
  podeExcluir,
}: {
  tarefa: TarefaView;
  equipe: MembroEquipe[];
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [visualizando, setVisualizando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const [titulo, setTitulo] = useState(tarefa.titulo);
  const [descricao, setDescricao] = useState(tarefa.descricao ?? "");
  const [responsavelId, setResponsavelId] = useState(tarefa.responsavelId ?? "");
  const [prazo, setPrazo] = useState(tarefa.prazo ?? "");
  const [erro, setErro] = useState<string | null>(null);

  const statusLabel = STATUS_OPCOES.find((s) => s.value === tarefa.status)?.label ?? tarefa.status;

  async function mudarStatus(novo: string) {
    setCarregando(true);
    await supabase.from("tarefas").update({ status: novo }).eq("id", tarefa.id);
    setCarregando(false);
    router.refresh();
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await supabase
      .from("tarefas")
      .update({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        responsavel_id: responsavelId || null,
        prazo: prazo || null,
      })
      .eq("id", tarefa.id);
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEditando(false);
    router.refresh();
  }

  async function excluir() {
    setCarregando(true);
    await supabase.from("tarefas").delete().eq("id", tarefa.id);
    setCarregando(false);
    setConfirmandoExclusao(false);
    router.refresh();
  }

  if (editando) {
    return (
      <li className="rounded border border-neutral-300 bg-neutral-50 p-3">
        <form onSubmit={salvarEdicao} className="space-y-3">
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
            <label className="block text-xs font-medium text-neutral-500">Descrição</label>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
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
                <option value="">Ninguém atribuído</option>
                {equipe.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-500">Prazo</label>
              <input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={carregando}
              className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              {carregando ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="flex items-center gap-1.5 rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded border border-neutral-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{tarefa.titulo}</p>
          <p className="text-xs text-neutral-500">
            {tarefa.responsavelNome ?? "Ninguém atribuído"}
            {tarefa.prazo ? ` · prazo ${formatarData(tarefa.prazo)}` : ""}
          </p>
          {visualizando && (
            <div className="mt-2 space-y-1 rounded border border-neutral-200 bg-neutral-50 p-2">
              <p className="text-xs font-medium text-neutral-500">Descrição</p>
              <p className="whitespace-pre-wrap text-sm text-neutral-700">
                {tarefa.descricao || "Sem descrição."}
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={() => setVisualizando((v) => !v)}
          className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          <Eye size={12} strokeWidth={2} aria-hidden="true" />
          {visualizando ? "Ocultar" : "Visualizar"}
        </button>
        {podeEditar && (
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            <Pencil size={12} strokeWidth={2} aria-hidden="true" />
            Editar
          </button>
        )}
        {podeExcluir &&
          (!confirmandoExclusao ? (
            <button
              onClick={() => setConfirmandoExclusao(true)}
              className="flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
              Excluir
            </button>
          ) : (
            <span className="flex items-center gap-1">
              <button
                onClick={excluir}
                disabled={carregando}
                className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
                {carregando ? "…" : "Confirmar"}
              </button>
              <button
                onClick={() => setConfirmandoExclusao(false)}
                className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
              >
                Cancelar
              </button>
            </span>
          ))}
      </div>
    </li>
  );
}
