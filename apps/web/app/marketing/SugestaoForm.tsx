"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Proposta = { id: string; titulo: string; descricao: string | null };

const FORMATOS = [
  { value: "post", label: "Post (Instagram/Facebook)" },
  { value: "whatsapp", label: "Mensagem de WhatsApp" },
  { value: "carrossel", label: "Carrossel" },
  { value: "roteiro_video", label: "Roteiro de vídeo" },
  { value: "outro", label: "Outro" },
];

export function SugestaoForm({ propostas }: { propostas: Proposta[] }) {
  const router = useRouter();

  const [formato, setFormato] = useState(FORMATOS[0].value);
  const [propostaId, setPropostaId] = useState("");
  const [contexto, setContexto] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function usarProposta(id: string) {
    setPropostaId(id);
    const p = propostas.find((x) => x.id === id);
    if (p?.descricao) setContexto(p.descricao);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setResultado(null);

    if (!contexto.trim()) {
      setErro("Preencha o contexto (ou escolha uma proposta com texto acima).");
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch("/api/marketing/sugestao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formato, contexto_usado: contexto }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao gerar sugestão");
        return;
      }
      setResultado(data.sugestao);
    } catch {
      setErro("Falha de conexão ao gerar sugestão. Tente de novo.");
    } finally {
      setCarregando(false);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Formato</label>
          <select
            value={formato}
            onChange={(e) => setFormato(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {FORMATOS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {propostas.length > 0 && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Usar proposta cadastrada</label>
            <select
              value={propostaId}
              onChange={(e) => usarProposta(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">nenhuma — digitar abaixo</option>
              {propostas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Contexto (proposta/diretriz que a IA vai usar como base)
        </label>
        <textarea
          rows={4}
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {carregando ? "Gerando…" : "Gerar sugestão"}
      </button>

      {resultado && (
        <div className="rounded border border-neutral-200 bg-neutral-50 p-3 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Sugestão gerada por IA — revisão humana obrigatória antes de qualquer uso
          </p>
          <p className="whitespace-pre-wrap text-sm">{resultado}</p>
        </div>
      )}
    </form>
  );
}
