"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { labelTerritorio } from "@/lib/territorio";

type Territorio = { id: string; nome_bairro: string | null; cidade: string | null };

export function LiderancaForm({
  campanhaId,
  territorios,
}: {
  campanhaId: string;
  territorios: Territorio[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [territorioId, setTerritorioId] = useState("");
  const [metaCadastros, setMetaCadastros] = useState("");
  const [metaPeriodo, setMetaPeriodo] = useState("total");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const { data: lideranca, error } = await supabase
      .from("liderancas")
      .insert({
        campanha_id: campanhaId,
        nome: nome.trim(),
        telefone: telefone.trim(),
        cidade: cidade.trim() || null,
        bairro: bairro.trim() || null,
        territorio_id: territorioId || null,
      })
      .select("id")
      .single();

    if (error || !lideranca) {
      setCarregando(false);
      setErro(error?.message ?? "erro ao criar liderança");
      return;
    }

    if (metaCadastros.trim()) {
      const { error: metaError } = await supabase.from("metas").insert({
        campanha_id: campanhaId,
        tipo: "lideranca",
        lideranca_id: lideranca.id,
        periodo: metaPeriodo,
        alvo_cadastros: Number(metaCadastros),
      });
      if (metaError) {
        setCarregando(false);
        setErro(`Liderança criada, mas a meta falhou: ${metaError.message}`);
        router.refresh();
        return;
      }
    }

    setCarregando(false);
    setSucesso(`Liderança "${nome}" criada.`);
    setNome("");
    setTelefone("");
    setCidade("");
    setBairro("");
    setTerritorioId("");
    setMetaCadastros("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Nome</label>
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Telefone</label>
          <input
            required
            placeholder="(81) 9xxxx-xxxx"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Cidade</label>
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Bairro</label>
          <input
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Território (mapa)</label>
          <select
            value={territorioId}
            onChange={(e) => setTerritorioId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">nenhum</option>
            {territorios.map((t) => (
              <option key={t.id} value={t.id}>
                {labelTerritorio(t.nome_bairro, t.cidade)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Meta de cadastros (opcional)</label>
          <input
            type="number"
            min="1"
            value={metaCadastros}
            onChange={(e) => setMetaCadastros(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        {metaCadastros.trim() && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Período da meta</label>
            <select
              value={metaPeriodo}
              onChange={(e) => setMetaPeriodo(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="total">Total</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
        )}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {carregando ? "Criando…" : "Criar liderança"}
      </button>
    </form>
  );
}
