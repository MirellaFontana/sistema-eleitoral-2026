"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function TemaForm({ campanhaId, proximaOrdem }: { campanhaId: string; proximaOrdem: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const { error } = await supabase
      .from("temas_campanha")
      .insert({ campanha_id: campanhaId, nome, ordem: proximaOrdem });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setSucesso(`Tema "${nome}" criado.`);
    setTimeout(() => setSucesso(null), 3000);
    setNome("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Novo tema</label>
        <input
          required
          placeholder="ex.: Saúde, Educação, Biografia"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm w-64"
        />
      </div>
      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Adicionando…" : "Adicionar tema"}
      </button>
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="w-full text-sm text-green-700">{sucesso}</p>}
    </form>
  );
}
