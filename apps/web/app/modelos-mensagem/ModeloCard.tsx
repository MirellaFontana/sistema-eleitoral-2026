"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ModeloView = {
  id: string;
  titulo: string;
  conteudo: string;
  versao: number;
  status: string;
  criadoPorNome: string | null;
  aprovadoPorNome: string | null;
  atualizadoEm: string;
};

export function ModeloCard({
  modelo,
  podeEditar,
  podeAprovar,
  podeExcluir,
  currentUserId,
}: {
  modelo: ModeloView;
  podeEditar: boolean;
  podeAprovar: boolean;
  podeExcluir: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [editando, setEditando] = useState(false);
  const [conteudo, setConteudo] = useState(modelo.conteudo);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function salvarEdicao() {
    setErro(null);
    setCarregando(true);
    const { error } = await supabase
      .from("modelos_mensagem")
      .update({ conteudo: conteudo.trim() })
      .eq("id", modelo.id);
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEditando(false);
    router.refresh();
  }

  async function aprovar() {
    setErro(null);
    setCarregando(true);
    const { error } = await supabase
      .from("modelos_mensagem")
      .update({ status: "aprovado", aprovado_por: currentUserId, aprovado_em: new Date().toISOString() })
      .eq("id", modelo.id);
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    router.refresh();
  }

  async function excluir() {
    if (!confirm(`Excluir o modelo "${modelo.titulo}"?`)) return;
    const { error } = await supabase.from("modelos_mensagem").delete().eq("id", modelo.id);
    if (error) setErro(error.message);
    else router.refresh();
  }

  return (
    <li className="space-y-2 rounded border border-neutral-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{modelo.titulo}</p>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
          v{modelo.versao}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            modelo.status === "aprovado" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {modelo.status === "aprovado" ? "Aprovado" : "Rascunho"}
        </span>
      </div>

      {editando ? (
        <div className="space-y-2">
          <textarea
            rows={4}
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={salvarEdicao}
              disabled={carregando}
              className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              {carregando ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={() => {
                setConteudo(modelo.conteudo);
                setEditando(false);
              }}
              className="flex items-center gap-1 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
              Cancelar
            </button>
          </div>
          <p className="text-xs text-neutral-400">
            Salvar edição cria uma nova versão e volta o status para rascunho.
          </p>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-neutral-700">{modelo.conteudo}</p>
      )}

      <p className="text-xs text-neutral-400">
        Criado por {modelo.criadoPorNome ?? "—"}
        {modelo.status === "aprovado" && modelo.aprovadoPorNome && ` · Aprovado por ${modelo.aprovadoPorNome}`}
        {" · Atualizado em "}
        {new Date(modelo.atualizadoEm).toLocaleDateString("pt-BR")}
      </p>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {!editando && (
        <div className="flex flex-wrap gap-2">
          {podeEditar && (
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              <Pencil size={12} strokeWidth={2} aria-hidden="true" />
              Editar
            </button>
          )}
          {podeAprovar && modelo.status === "rascunho" && (
            <button
              onClick={aprovar}
              disabled={carregando}
              className="flex items-center gap-1 rounded border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              <CheckCircle2 size={12} strokeWidth={2} aria-hidden="true" />
              Aprovar
            </button>
          )}
          {podeExcluir && (
            <button
              onClick={excluir}
              className="flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
              Excluir
            </button>
          )}
        </div>
      )}
    </li>
  );
}
