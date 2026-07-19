"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CANAIS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "outro", label: "Outro" },
];

export function RespostaForm() {
  const router = useRouter();

  const [pergunta, setPergunta] = useState("");
  const [canalOrigem, setCanalOrigem] = useState(CANAIS[0].value);
  const [contextoAdicional, setContextoAdicional] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setResultado(null);

    if (!pergunta.trim()) {
      setErro("Cole a pergunta recebida na rede social.");
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch("/api/marketing/resposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pergunta,
          canal_origem: canalOrigem,
          contexto_adicional: contextoAdicional.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao gerar resposta");
        return;
      }
      setResultado(data.resposta_sugerida);
    } catch {
      setErro("Falha de conexão ao gerar resposta. Tente de novo.");
    } finally {
      setCarregando(false);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Pergunta recebida na rede social
        </label>
        <textarea
          rows={3}
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Canal de origem</label>
          <select
            value={canalOrigem}
            onChange={(e) => setCanalOrigem(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {CANAIS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Contexto adicional (opcional — algo que não esteja na base de conhecimento)
        </label>
        <textarea
          rows={2}
          value={contextoAdicional}
          onChange={(e) => setContextoAdicional(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Gerando…" : "Gerar resposta sugerida"}
      </button>

      {resultado && (
        <div className="rounded border border-neutral-200 bg-neutral-50 p-3 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Sugestão gerada por IA — revisão humana obrigatória antes de postar
          </p>
          <p className="whitespace-pre-wrap text-sm">{resultado}</p>
        </div>
      )}
    </form>
  );
}
