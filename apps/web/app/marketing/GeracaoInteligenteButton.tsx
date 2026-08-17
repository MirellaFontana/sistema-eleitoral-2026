"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FORMATO_LABEL: Record<string, string> = {
  post: "Post",
  stories: "Stories",
  whatsapp: "WhatsApp",
  carrossel: "Carrossel",
};

const FORMATO_ICON: Record<string, string> = {
  post: "📸",
  stories: "⏰",
  whatsapp: "💬",
  carrossel: "🔄",
};

type Oportunidade = {
  oportunidade: string;
  fonte: string;
  tema: string;
  publico_alvo: string;
  angulo: string;
  urgencia: string;
  proposta_relacionada: string;
  justificativa: string;
};

type Peca = { formato: string; sugestao: string | null; erro: string | null };

export function GeracaoInteligenteButton() {
  const router = useRouter();
  const [oportunidade, setOportunidade] = useState<Oportunidade | null>(null);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [semOportunidade, setSemOportunidade] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleClick() {
    setErro(null);
    setOportunidade(null);
    setPecas([]);
    setSemOportunidade(false);
    setCarregando(true);

    try {
      const res = await fetch("/api/marketing/gerar-inteligente", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao gerar");
        return;
      }
      if (!data.oportunidade) {
        setSemOportunidade(true);
        return;
      }
      setOportunidade(data.oportunidade);
      setPecas(data.pecas ?? []);
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  const urgenciaCor: Record<string, string> = {
    alta: "bg-red-100 text-red-800",
    media: "bg-yellow-100 text-yellow-800",
    baixa: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleClick}
        disabled={carregando}
        className="rounded bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
      >
        {carregando ? "Buscando oportunidade e gerando conteúdo…" : "Gerar conteúdo inteligente"}
      </button>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {semOportunidade && (
        <p className="text-sm text-neutral-500">
          Nenhuma oportunidade identificada no momento. Cadastre mais dados no monitoramento, demandas ou sinais de campo.
        </p>
      )}

      {oportunidade && (
        <div className="space-y-4">
          <div className="rounded border border-purple-200 bg-purple-50 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                Oportunidade identificada
              </p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${urgenciaCor[oportunidade.urgencia] ?? "bg-neutral-100"}`}>
                {oportunidade.urgencia}
              </span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                {oportunidade.fonte}
              </span>
            </div>
            <p className="text-sm font-medium text-neutral-800">{oportunidade.oportunidade}</p>
            <div className="grid grid-cols-1 gap-1 text-xs text-neutral-600 sm:grid-cols-2">
              <p><span className="font-medium">Tema:</span> {oportunidade.tema}</p>
              <p><span className="font-medium">Público:</span> {oportunidade.publico_alvo}</p>
              <p><span className="font-medium">Ângulo:</span> {oportunidade.angulo}</p>
              <p className="sm:col-span-2"><span className="font-medium">Proposta:</span> {oportunidade.proposta_relacionada}</p>
            </div>
            <p className="text-xs text-neutral-500 italic">{oportunidade.justificativa}</p>
          </div>

          {pecas.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Conteúdo gerado — 4 formatos
              </p>
              {pecas.map((p) => (
                <div key={p.formato} className="rounded border border-indigo-100 bg-indigo-50 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    {FORMATO_ICON[p.formato] ?? "📄"} {FORMATO_LABEL[p.formato] ?? p.formato} — revisão humana obrigatória
                  </p>
                  {p.sugestao ? (
                    <p className="whitespace-pre-wrap text-sm text-neutral-800">{p.sugestao}</p>
                  ) : (
                    <p className="text-sm text-red-600">{p.erro ?? "erro ao gerar"}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
