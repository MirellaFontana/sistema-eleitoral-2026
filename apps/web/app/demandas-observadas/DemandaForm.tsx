"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DemandaForm({ campanhaId }: { campanhaId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [regiao, setRegiao] = useState("");
  const [cidade, setCidade] = useState("");
  const [tema, setTema] = useState("");
  const [demanda, setDemanda] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const { error } = await supabase.from("demandas_observadas").insert({
      campanha_id: campanhaId,
      regiao: regiao.trim() || null,
      cidade: cidade.trim() || null,
      tema: tema.trim() || null,
      demanda,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso("Demanda registrada.");
    setRegiao("");
    setCidade("");
    setTema("");
    setDemanda("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Região</label>
          <input
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Cidade</label>
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Tema</label>
          <input
            placeholder="saúde, emprego…"
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Demanda</label>
        <textarea
          required
          rows={3}
          value={demanda}
          onChange={(e) => setDemanda(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {carregando ? "Salvando…" : "Registrar demanda"}
      </button>
    </form>
  );
}
