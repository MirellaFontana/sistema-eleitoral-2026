"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AnaliseButton() {
  const router = useRouter();
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleClick() {
    setErro(null);
    setResultado(null);
    setCarregando(true);

    try {
      const res = await fetch("/api/marketing/analise", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao gerar análise");
        return;
      }
      setResultado(data.analise);
      router.refresh();
    } catch {
      setErro("Falha de conexão ao gerar análise. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleClick}
        disabled={carregando}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {carregando ? "Analisando…" : "Analisar pontos cegos"}
      </button>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {resultado && (
        <div className="rounded border border-neutral-200 bg-neutral-50 p-3 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Análise gerada por IA — apoio à decisão, não instrução automática
          </p>
          <p className="whitespace-pre-wrap text-sm">{resultado}</p>
        </div>
      )}
    </div>
  );
}
