"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { labelTerritorio } from "@/lib/territorio";

type Opcao = { id: string; nome?: string; nome_bairro?: string | null; cidade?: string | null };

export function MetaForm({
  campanhaId,
  liderancas,
  territorios,
}: {
  campanhaId: string;
  liderancas: Opcao[];
  territorios: Opcao[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("geral");
  const [alvoId, setAlvoId] = useState("");
  const [periodo, setPeriodo] = useState("total");
  const [alvoCadastros, setAlvoCadastros] = useState("");
  const [alvoApoiadores, setAlvoApoiadores] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (tipo !== "geral" && !alvoId) {
      setErro(tipo === "lideranca" ? "Escolha a liderança." : "Escolha o território.");
      return;
    }

    setCarregando(true);
    const { error } = await supabase.from("metas").insert({
      campanha_id: campanhaId,
      tipo,
      lideranca_id: tipo === "lideranca" ? alvoId : null,
      territorio_id: tipo === "territorio" ? alvoId : null,
      periodo,
      alvo_cadastros: Number(alvoCadastros),
      alvo_apoiadores: alvoApoiadores.trim() ? Number(alvoApoiadores) : null,
    });
    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setAberto(false);
    setAlvoId("");
    setAlvoCadastros("");
    setAlvoApoiadores("");
    router.refresh();
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
      >
        + Nova meta
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded bg-neutral-50 p-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
              setAlvoId("");
            }}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="geral">Campanha geral</option>
            <option value="territorio">Bairro/território</option>
            <option value="lideranca">Liderança</option>
          </select>
        </div>

        {tipo === "lideranca" && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Liderança</label>
            <select
              value={alvoId}
              onChange={(e) => setAlvoId(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">selecione…</option>
              {liderancas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {tipo === "territorio" && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Território</label>
            <select
              value={alvoId}
              onChange={(e) => setAlvoId(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">selecione…</option>
              {territorios.map((t) => (
                <option key={t.id} value={t.id}>
                  {labelTerritorio(t.nome_bairro, t.cidade)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Período</label>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="total">Total</option>
            <option value="mensal">Mensal</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Meta de cadastros</label>
          <input
            type="number"
            min="1"
            required
            value={alvoCadastros}
            onChange={(e) => setAlvoCadastros(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Meta de apoiadores (opcional)</label>
          <input
            type="number"
            min="1"
            value={alvoApoiadores}
            onChange={(e) => setAlvoApoiadores(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={carregando}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {carregando ? "Salvando…" : "Salvar meta"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setErro(null);
          }}
          className="rounded px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
