"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FORMATOS = [
  { value: "post",          label: "Post",              desc: "Instagram · Facebook · LinkedIn",    icon: "📸" },
  { value: "carrossel",     label: "Carrossel",         desc: "Série de slides (6–10 frames)",      icon: "🔄" },
  { value: "reel",          label: "Reel / Vídeo curto", desc: "15 a 90 segundos com legenda",      icon: "🎬" },
  { value: "stories",       label: "Stories",           desc: "Frames verticais de 24h",            icon: "⏰" },
  { value: "whatsapp",      label: "WhatsApp",          desc: "Mensagem de difusão ou grupo",       icon: "💬" },
  { value: "thread",        label: "Thread",            desc: "Série de tweets no X/Twitter",       icon: "🧵" },
  { value: "roteiro_video", label: "Roteiro de vídeo",  desc: "Produção de 1 a 5 minutos",          icon: "🎥" },
  { value: "live",          label: "Live / Transmissão", desc: "Roteiro de ao vivo estruturado",    icon: "📡" },
  { value: "roteiro_radio", label: "Roteiro para rádio", desc: "Spot, jingle ou inserção eleitoral", icon: "📻" },
  { value: "roteiro_tv",    label: "Roteiro para TV",    desc: "Inserção ou programa eleitoral",     icon: "📺" },
  { value: "outro",         label: "Outro",             desc: "Formato livre — descreva no foco",   icon: "💡" },
];

type ResultadoFormato = { formato: string; sugestao: string };

export function SugestaoForm() {
  const router = useRouter();

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set([FORMATOS[0].value]));
  const [variacoesAB, setVariacoesAB] = useState(false);
  const [duracao, setDuracao] = useState("");
  const [foco, setFoco] = useState("");
  const pedeTempo = selecionados.has("roteiro_radio") || selecionados.has("roteiro_tv");
  const [resultados, setResultados] = useState<ResultadoFormato[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function toggleFormato(value: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selecionados.size === 0) { setErro("Selecione pelo menos um formato."); return; }
    setErro(null);
    setResultados([]);
    setCarregando(true);

    try {
      const formatos = Array.from(selecionados);
      const respostas = await Promise.all(
        formatos.map(async (fmt) => {
          const res = await fetch("/api/marketing/sugestao", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ formato: fmt, foco: foco.trim() || undefined, duracao: duracao.trim() || undefined, variacoes_ab: variacoesAB || undefined }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "erro ao gerar");
          return { formato: fmt, sugestao: data.sugestao as string };
        }),
      );
      setResultados(respostas);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  const multiFormato = selecionados.size > 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded border border-neutral-200 p-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-neutral-500">
            Formato da peça {multiFormato && <span className="text-indigo-600">({selecionados.size} selecionados)</span>}
          </p>
          <p className="text-xs text-neutral-400">Selecione 1 ou mais formatos</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FORMATOS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => toggleFormato(f.value)}
              className={`rounded border p-2.5 text-left transition-colors ${
                selecionados.has(f.value)
                  ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                  : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
              }`}
            >
              <span className="text-base leading-none">{f.icon}</span>{" "}
              <span className="text-sm font-medium">{f.label}</span>
              <p className="mt-0.5 text-xs text-neutral-500">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {pedeTempo && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">
            Tempo disponível <span className="font-normal text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="ex: 30 segundos, 1 minuto, 2 minutos"
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            maxLength={50}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
          <p className="text-xs text-neutral-400">
            Informe a duração da inserção — o roteiro será ajustado ao tempo.
          </p>
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Foco / tema específico{" "}
          <span className="font-normal text-neutral-400">(opcional)</span>
        </label>
        <input
          type="text"
          placeholder="ex: saúde pública no centro, educação infantil, geração de empregos"
          value={foco}
          onChange={(e) => setFoco(e.target.value)}
          maxLength={200}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
        <p className="text-xs text-neutral-400">
          Sem foco, a IA usa toda a base de conhecimento da campanha automaticamente.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
        <input
          type="checkbox"
          checked={variacoesAB}
          onChange={(e) => setVariacoesAB(e.target.checked)}
          className="rounded border-neutral-300"
        />
        Gerar 3 variações A/B (hooks e CTAs diferentes)
      </label>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={carregando || selecionados.size === 0}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando
          ? `Gerando ${selecionados.size} peça(s)…`
          : selecionados.size > 1
            ? `Gerar ${selecionados.size} peças de uma vez`
            : "Gerar sugestão de peça"}
      </button>

      {resultados.length > 0 && (
        <div className="space-y-3">
          {resultados.map((r) => {
            const meta = FORMATOS.find((f) => f.value === r.formato);
            return (
              <div key={r.formato} className="rounded border border-indigo-100 bg-indigo-50 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  {meta?.icon} {meta?.label ?? r.formato} — revisão humana obrigatória
                </p>
                <p className="whitespace-pre-wrap text-sm text-neutral-800">{r.sugestao}</p>
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}
