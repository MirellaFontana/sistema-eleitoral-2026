"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function TerritorioForm({ campanhaId }: { campanhaId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [nomeBairro, setNomeBairro] = useState("");
  const [zonaEleitoral, setZonaEleitoral] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase
      .from("territorios")
      .insert({ campanha_id: campanhaId, nome_bairro: nomeBairro, zona_eleitoral: zonaEleitoral });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNomeBairro("");
    setZonaEleitoral("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Bairro</label>
        <input
          required
          value={nomeBairro}
          onChange={(e) => setNomeBairro(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Zona eleitoral</label>
        <input
          value={zonaEleitoral}
          onChange={(e) => setZonaEleitoral(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {carregando ? "Adicionando…" : "Adicionar território"}
      </button>
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
    </form>
  );
}
