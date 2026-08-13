"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

export function AjudaSistema() {
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [provedor, setProvedor] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!pergunta.trim() || carregando) return;
    setCarregando(true);
    setErro(null);
    setResposta(null);
    try {
      const res = await fetch("/api/ajuda/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: pergunta.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao consultar");
        return;
      }
      setResposta(data.resposta);
      setProvedor(data.provedor);
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={enviar} className="space-y-2">
        <textarea
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Ex.: Como cadastro um novo apoiador? Onde vejo os alertas? Como gero o briefing diário?"
          rows={3}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm placeholder:text-neutral-400"
        />
        <button
          type="submit"
          disabled={carregando || !pergunta.trim()}
          className="flex items-center gap-1.5 rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          <HelpCircle size={14} strokeWidth={2} />
          {carregando ? "Consultando…" : "Perguntar"}
        </button>
      </form>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {resposta && (
        <div className="rounded border border-neutral-200 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Resposta
            </h3>
            {provedor && (
              <span className="text-[10px] text-neutral-400">{provedor}</span>
            )}
          </div>
          <div className="prose prose-sm max-w-none text-sm text-neutral-800 whitespace-pre-wrap">
            {resposta}
          </div>
        </div>
      )}
    </div>
  );
}
