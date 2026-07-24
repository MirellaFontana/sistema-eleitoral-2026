"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Shield, Trash2, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FuncaoView } from "./page";

type PermissaoGrupo = {
  grupo: string;
  permissoes: { valor: string; label: string }[];
};

export function FuncaoCard({
  funcao,
  isCoordCampanha,
  permissoesPorGrupo,
}: {
  funcao: FuncaoView;
  isCoordCampanha: boolean;
  permissoesPorGrupo: PermissaoGrupo[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [expandido, setExpandido] = useState(false);
  const [editando, setEditando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set(funcao.permissoes));
  const [carregando, setCarregando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const totalPermissoes = permissoesPorGrupo.reduce((acc, g) => acc + g.permissoes.length, 0);

  function togglePermissao(p: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function marcarTodas() {
    const todas = new Set<string>();
    for (const g of permissoesPorGrupo) {
      for (const p of g.permissoes) todas.add(p.valor);
    }
    setSelecionadas(todas);
  }

  function desmarcarTodas() {
    setSelecionadas(new Set());
  }

  async function salvarPermissoes() {
    setCarregando(true);

    const atuais = new Set(funcao.permissoes);
    const remover = [...atuais].filter((p) => !selecionadas.has(p));
    const adicionar = [...selecionadas].filter((p) => !atuais.has(p));

    for (const p of remover) {
      await supabase
        .from("funcao_permissoes")
        .delete()
        .eq("funcao_id", funcao.id)
        .eq("permissao", p);
    }

    if (adicionar.length > 0) {
      await supabase
        .from("funcao_permissoes")
        .insert(adicionar.map((p) => ({ funcao_id: funcao.id, permissao: p })));
    }

    setCarregando(false);
    setEditando(false);
    router.refresh();
  }

  async function excluirFuncao() {
    setCarregando(true);
    await supabase.from("funcoes_campanha").delete().eq("id", funcao.id);
    setCarregando(false);
    setConfirmandoExclusao(false);
    router.refresh();
  }

  return (
    <div className="rounded border border-neutral-200 bg-white">
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-3">
          <Shield
            size={16}
            strokeWidth={2}
            className={funcao.sistema ? "text-indigo-600" : "text-neutral-400"}
            aria-hidden="true"
          />
          <div>
            <span className="text-sm font-medium text-neutral-900">{funcao.nome}</span>
            {funcao.sistema && (
              <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                padrão
              </span>
            )}
            {funcao.descricao && (
              <p className="text-xs text-neutral-500">{funcao.descricao}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <Users size={12} strokeWidth={2} aria-hidden="true" />
            {funcao.membros}
          </span>
          <span className="text-xs text-neutral-400">
            {funcao.permissoes.length}/{totalPermissoes}
          </span>
          {expandido ? (
            <ChevronUp size={16} className="text-neutral-400" aria-hidden="true" />
          ) : (
            <ChevronDown size={16} className="text-neutral-400" aria-hidden="true" />
          )}
        </div>
      </div>

      {expandido && (
        <div className="border-t border-neutral-100 px-4 py-3">
          {isCoordCampanha && !editando && (
            <div className="mb-3 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditando(true);
                  setSelecionadas(new Set(funcao.permissoes));
                }}
                className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Editar permissões
              </button>
              {!funcao.sistema && !confirmandoExclusao && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmandoExclusao(true);
                  }}
                  className="flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
                  Excluir
                </button>
              )}
              {confirmandoExclusao && (
                <span className="flex items-center gap-1 text-xs">
                  <button
                    onClick={excluirFuncao}
                    disabled={carregando}
                    className="flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 font-medium text-white disabled:opacity-50"
                  >
                    <Trash2 size={11} strokeWidth={2} aria-hidden="true" />
                    {carregando ? "…" : "Confirmar"}
                  </button>
                  <button
                    onClick={() => setConfirmandoExclusao(false)}
                    className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100"
                  >
                    <X size={12} strokeWidth={2} aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
          )}

          {editando && (
            <div className="mb-3 flex gap-2">
              <button
                onClick={salvarPermissoes}
                disabled={carregando}
                className="flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Check size={12} strokeWidth={2} aria-hidden="true" />
                {carregando ? "Salvando…" : "Salvar"}
              </button>
              <button
                onClick={() => {
                  setEditando(false);
                  setSelecionadas(new Set(funcao.permissoes));
                }}
                className="rounded border border-neutral-300 px-2.5 py-1 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={marcarTodas}
                className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
              >
                Marcar todas
              </button>
              <button
                onClick={desmarcarTodas}
                className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
              >
                Desmarcar todas
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {permissoesPorGrupo.map((g) => (
              <div key={g.grupo}>
                <p className="mb-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  {g.grupo}
                </p>
                <div className="space-y-1">
                  {g.permissoes.map((p) => {
                    const ativa = selecionadas.has(p.valor);
                    if (editando) {
                      return (
                        <label key={p.valor} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ativa}
                            onChange={() => togglePermissao(p.valor)}
                            className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          {p.label}
                        </label>
                      );
                    }
                    return (
                      <div key={p.valor} className="flex items-center gap-1.5 text-sm">
                        {ativa ? (
                          <Check size={12} strokeWidth={2.5} className="text-indigo-600" aria-hidden="true" />
                        ) : (
                          <X size={12} strokeWidth={2} className="text-neutral-300" aria-hidden="true" />
                        )}
                        <span className={ativa ? "text-neutral-800" : "text-neutral-400"}>
                          {p.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {funcao.nome === "Coordenador de campanha" && (
            <p className="mt-3 rounded bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              O coordenador de campanha tem acesso total automaticamente, independente das
              permissões marcadas acima. Além disso, controles não-delegáveis (editar campanha,
              gerenciar equipe, enviar mensagem a eleitor) são exclusivos deste papel.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
