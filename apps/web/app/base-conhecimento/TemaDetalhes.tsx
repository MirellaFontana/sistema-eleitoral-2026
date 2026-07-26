"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  temaId: string;
  publicosAlvo: string[];
  regioesPrioritarias: string[];
  podeEditar: boolean;
};

function TagInput({
  label,
  placeholder,
  valores,
  onChange,
}: {
  label: string;
  placeholder: string;
  valores: string[];
  onChange: (v: string[]) => void;
}) {
  const [texto, setTexto] = useState("");

  function adicionar() {
    const limpo = texto.trim();
    if (!limpo || valores.includes(limpo)) return;
    onChange([...valores, limpo]);
    setTexto("");
  }

  function remover(idx: number) {
    onChange(valores.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <div className="flex flex-wrap gap-1">
        {valores.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
          >
            {v}
            <button
              type="button"
              onClick={() => remover(i)}
              className="text-indigo-400 hover:text-indigo-700"
              aria-label={`Remover ${v}`}
            >
              x
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          placeholder={placeholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          className="rounded border border-neutral-300 px-2 py-1 text-xs w-44"
        />
        <button
          type="button"
          onClick={adicionar}
          className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function TemaDetalhes({ temaId, publicosAlvo, regioesPrioritarias, podeEditar }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [publicos, setPublicos] = useState(publicosAlvo);
  const [regioes, setRegioes] = useState(regioesPrioritarias);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudou =
    JSON.stringify(publicos) !== JSON.stringify(publicosAlvo) ||
    JSON.stringify(regioes) !== JSON.stringify(regioesPrioritarias);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const { error } = await supabase
      .from("temas_campanha")
      .update({ publicos_alvo: publicos, regioes_prioritarias: regioes })
      .eq("id", temaId);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    router.refresh();
  }

  if (!podeEditar) {
    const temAlgo = publicosAlvo.length > 0 || regioesPrioritarias.length > 0;
    if (!temAlgo) return null;
    return (
      <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
        {publicosAlvo.length > 0 && (
          <span>Público: {publicosAlvo.join(", ")}</span>
        )}
        {regioesPrioritarias.length > 0 && (
          <span>Regiões: {regioesPrioritarias.join(", ")}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded border border-neutral-100 bg-neutral-50 p-2">
      <div className="flex flex-wrap gap-4">
        <TagInput
          label="Público-alvo"
          placeholder="ex.: idosos, jovens"
          valores={publicos}
          onChange={setPublicos}
        />
        <TagInput
          label="Regiões prioritárias"
          placeholder="ex.: Zona Norte, Centro"
          valores={regioes}
          onChange={setRegioes}
        />
      </div>
      {mudou && (
        <div className="flex items-center gap-2">
          <button
            onClick={salvar}
            disabled={salvando}
            className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          {erro && <span className="text-xs text-red-600">{erro}</span>}
        </div>
      )}
    </div>
  );
}
