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
  { value: "outro",         label: "Outro",             desc: "Formato livre — descreva no foco",   icon: "💡" },
];

export function SugestaoForm() {
  const router = useRouter();

  const [formato, setFormato] = useState(FORMATOS[0].value);
  const [foco, setFoco] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setResultado(null);
    setCarregando(true);

    try {
      const res = await fetch("/api/marketing/sugestao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formato, foco: foco.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao gerar sugestão");
        return;
      }
      setResultado(data.sugestao);
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded border border-neutral-200 p-4">
      <div>
        <p className="mb-2 text-xs font-medium text-neutral-500">Formato da peça</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FORMATOS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormato(f.value)}
              className={`rounded border p-2.5 text-left transition-colors ${
                formato === f.value
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

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Gerando sugestão…" : "Gerar sugestão de peça"}
      </button>

      {resultado && (
        <div className="rounded border border-indigo-100 bg-indigo-50 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Sugestão gerada por IA — revisão humana obrigatória antes de qualquer uso
          </p>
          <p className="whitespace-pre-wrap text-sm text-neutral-800">{resultado}</p>
        </div>
      )}
    </form>
  );
}
