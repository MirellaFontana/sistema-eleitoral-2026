"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type TermoView = {
  id: string;
  termo: string;
  rotulo: string | null;
  ativo: boolean;
};

export function TermosMonitoramento({
  campanhaId,
  termos,
}: {
  campanhaId: string;
  termos: TermoView[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.from("termos_monitoramento").insert({
      campanha_id: campanhaId,
      termo: termo.trim(),
      rotulo: rotulo.trim() || null,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setTermo("");
    setRotulo("");
    router.refresh();
  }

  async function alternarAtivo(id: string, ativo: boolean) {
    await supabase.from("termos_monitoramento").update({ ativo: !ativo }).eq("id", id);
    router.refresh();
  }

  async function excluir(id: string) {
    await supabase.from("termos_monitoramento").delete().eq("id", id);
    router.refresh();
  }

  const ativos = termos.filter((t) => t.ativo).length;

  return (
    <div className="rounded border border-neutral-200">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="flex w-full items-center gap-2 p-3 text-left hover:bg-neutral-50"
      >
        <ChevronRight
          size={14}
          className={`text-neutral-400 transition-transform ${aberto ? "rotate-90" : ""}`}
        />
        <span className="text-sm font-semibold">O que monitorar</span>
        <span className="text-xs text-neutral-400">
          {ativos} termo{ativos !== 1 ? "s" : ""} ativo{ativos !== 1 ? "s" : ""}
        </span>
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-neutral-100 p-4 pt-3">
          <p className="text-xs text-neutral-500">
            Cadastre tudo que a busca automática deve procurar — o próprio candidato, concorrentes,
            ou qualquer outra frase. A busca roda para todos os termos ativos.
          </p>

          <form onSubmit={adicionar} className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1 space-y-1">
              <label className="block text-xs font-medium text-neutral-500">Termo de busca</label>
              <input
                required
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder='Ex.: "Requião" ou candidato'
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="min-w-40 flex-1 space-y-1">
              <label className="block text-xs font-medium text-neutral-500">
                Rótulo <span className="font-normal text-neutral-400">(opcional)</span>
              </label>
              <input
                value={rotulo}
                onChange={(e) => setRotulo(e.target.value)}
                placeholder="Ex.: Concorrente"
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={carregando}
              className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              {carregando ? "Adicionando…" : "Adicionar"}
            </button>
          </form>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          {termos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {termos.map((t) => (
                <li
                  key={t.id}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                    t.ativo
                      ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                      : "border-neutral-200 bg-neutral-50 text-neutral-400"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => alternarAtivo(t.id, t.ativo)}
                    title={t.ativo ? "Desativar" : "Ativar"}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {t.termo}
                  </button>
                  {t.rotulo && <span className="opacity-70">· {t.rotulo}</span>}
                  <button
                    type="button"
                    onClick={() => excluir(t.id)}
                    title="Excluir termo"
                    className="ml-1 text-neutral-400 hover:text-red-600"
                  >
                    <Trash2 size={11} strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
