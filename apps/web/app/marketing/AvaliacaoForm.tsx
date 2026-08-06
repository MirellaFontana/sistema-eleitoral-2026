"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AvaliacaoJson = {
  legislacao?: { analise: string; veredicto: string };
  praticas_midia?: { analise: string; veredicto: string };
  viralidade?: { analise: string; nota: number };
  clareza?: { analise: string; nota: number };
  sintese?: { recomendacoes: string[]; decisao: string };
};

const FORMATOS_LABEL: Record<string, string> = {
  post: "Post",
  carrossel: "Carrossel",
  reel: "Reel / Vídeo curto",
  stories: "Stories",
  whatsapp: "WhatsApp",
  thread: "Thread (X/Twitter)",
  roteiro_video: "Roteiro de vídeo",
  live: "Live / Transmissão",
  roteiro_radio: "Roteiro para rádio",
  roteiro_tv: "Roteiro para TV",
  outro: "Outro",
};

const CANAIS = [
  { value: "instagram",   label: "Instagram" },
  { value: "tiktok",      label: "TikTok" },
  { value: "facebook",    label: "Facebook" },
  { value: "x_twitter",   label: "X (Twitter)" },
  { value: "youtube",     label: "YouTube" },
  { value: "whatsapp",    label: "WhatsApp" },
  { value: "linkedin",    label: "LinkedIn" },
  { value: "outro",       label: "Outro canal" },
];

function badgeLegislacao(veredicto: string) {
  if (veredicto === "CONFORME")      return "bg-green-100 text-green-800";
  if (veredicto === "NÃO CONFORME")  return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800"; // ATENÇÃO
}

function badgePraticas(veredicto: string) {
  if (veredicto === "ÓTIMO")       return "bg-green-100 text-green-800";
  if (veredicto === "A MELHORAR")  return "bg-orange-100 text-orange-800";
  return "bg-blue-100 text-blue-800"; // BOM
}

function corNota(nota: number) {
  if (nota >= 8) return "text-green-700";
  if (nota >= 6) return "text-yellow-700";
  return "text-red-700";
}

function badgeDecisao(decisao: string) {
  if (decisao === "aprovar")              return { cls: "bg-green-100 text-green-800",  label: "Aprovar" };
  if (decisao === "aprovar_com_ajustes")  return { cls: "bg-yellow-100 text-yellow-800", label: "Aprovar com ajustes" };
  return { cls: "bg-red-100 text-red-800", label: "Reprovar" };
}

function ResultadoAvaliacao({ av }: { av: AvaliacaoJson }) {
  const decisao = av.sintese?.decisao ? badgeDecisao(av.sintese.decisao) : null;

  return (
    <div className="space-y-4">
      {decisao && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-700">Decisão recomendada:</span>
          <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${decisao.cls}`}>
            {decisao.label}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {av.legislacao && (
          <div className="rounded border border-neutral-200 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Legislação eleitoral
              </p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeLegislacao(av.legislacao.veredicto)}`}>
                {av.legislacao.veredicto}
              </span>
            </div>
            <p className="text-sm text-neutral-700">{av.legislacao.analise}</p>
          </div>
        )}

        {av.praticas_midia && (
          <div className="rounded border border-neutral-200 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Boas práticas de mídia
              </p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgePraticas(av.praticas_midia.veredicto)}`}>
                {av.praticas_midia.veredicto}
              </span>
            </div>
            <p className="text-sm text-neutral-700">{av.praticas_midia.analise}</p>
          </div>
        )}

        {av.viralidade && (
          <div className="rounded border border-neutral-200 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Potencial de viralização
              </p>
              <span className={`text-lg font-bold ${corNota(av.viralidade.nota)}`}>
                {av.viralidade.nota}<span className="text-xs font-normal text-neutral-400">/10</span>
              </span>
            </div>
            <p className="text-sm text-neutral-700">{av.viralidade.analise}</p>
          </div>
        )}

        {av.clareza && (
          <div className="rounded border border-neutral-200 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Clareza e eficácia
              </p>
              <span className={`text-lg font-bold ${corNota(av.clareza.nota)}`}>
                {av.clareza.nota}<span className="text-xs font-normal text-neutral-400">/10</span>
              </span>
            </div>
            <p className="text-sm text-neutral-700">{av.clareza.analise}</p>
          </div>
        )}
      </div>

      {av.sintese?.recomendacoes && av.sintese.recomendacoes.length > 0 && (
        <div className="rounded border border-neutral-200 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Recomendações
          </p>
          <ul className="space-y-1.5">
            {av.sintese.recomendacoes.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-neutral-700">
                <span className="mt-0.5 flex-shrink-0 text-indigo-500">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        Avaliação gerada por IA — revisão por profissional jurídico e de marketing antes de qualquer decisão final.
      </p>
    </div>
  );
}

export function AvaliacaoForm() {
  const router = useRouter();

  const [formato, setFormato] = useState("post");
  const [canal, setCanal] = useState("instagram");
  const [descricao, setDescricao] = useState("");
  const [resultado, setResultado] = useState<AvaliacaoJson | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setResultado(null);

    if (!descricao.trim()) {
      setErro("Descreva ou cole o texto da peça para avaliar.");
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch("/api/marketing/avaliar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formato, canal, descricao_peca: descricao }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro ao avaliar a peça.");
        return;
      }
      setResultado(data.avaliacao_json as AvaliacaoJson);
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-4 rounded border border-neutral-200 p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Formato da peça</label>
            <select
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {Object.entries(FORMATOS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Canal de publicação</label>
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {CANAIS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">
            Texto / descrição da peça a avaliar
          </label>
          <textarea
            rows={6}
            placeholder="Cole o texto completo da peça, descreva o roteiro, os slides ou o conteúdo do vídeo. Quanto mais detalhado, melhor a avaliação."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {carregando ? "Avaliando peça…" : "Avaliar peça"}
        </button>
      </form>

      {resultado && (
        <div className="border-t border-neutral-200 pt-4">
          <ResultadoAvaliacao av={resultado} />
        </div>
      )}
    </div>
  );
}
