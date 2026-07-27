"use client";

import { useState } from "react";
import { Download, ImagePlus, Wand2 } from "lucide-react";

const FORMATOS = [
  { value: "post_instagram", label: "Post Instagram (1:1)" },
  { value: "stories", label: "Stories (9:16)" },
  { value: "facebook", label: "Facebook (16:9)" },
  { value: "twitter", label: "X / Twitter (16:9)" },
  { value: "whatsapp", label: "WhatsApp (1:1)" },
];

const EXEMPLO =
  "Cena de mercado municipal brasileiro no interior do Paraná ao amanhecer, feirantes descarregando caixas, iluminação dourada, mood esperançoso, composição com espaço vazio no canto inferior direito para overlay de texto e foto do candidato.";

export function GerarImagemForm() {
  const [prompt, setPrompt] = useState("");
  const [formato, setFormato] = useState(FORMATOS[0].value);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);

  async function gerar() {
    if (!prompt.trim()) return;
    setGerando(true);
    setErro(null);
    if (imagemUrl) URL.revokeObjectURL(imagemUrl);
    setImagemUrl(null);

    try {
      const res = await fetch("/api/marketing/gerar-imagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), formato }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErro(data.error ?? "Erro ao gerar imagem");
      } else {
        const blob = await res.blob();
        setImagemUrl(URL.createObjectURL(blob));
      }
    } catch {
      setErro("Erro de rede ao gerar imagem");
    }
    setGerando(false);
  }

  return (
    <div className="space-y-3 rounded border border-neutral-200 p-4">
      <p className="text-xs text-neutral-500">
        Escreva o prompt exato da cena que a Gemini deve criar. A arte crua vem sem texto legal —
        depois de baixar, suba a versão finalizada em Peças de Conteúdo para revisão de compliance.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,220px]">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Prompt da imagem</label>
          <textarea
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={EXEMPLO}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => setPrompt(EXEMPLO)}
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
          >
            <Wand2 size={11} strokeWidth={2} />
            Usar exemplo
          </button>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Formato</label>
          <select
            value={formato}
            onChange={(e) => setFormato(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {FORMATOS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-neutral-400">
            Modelo: gemini-2.5-flash-image (nano-banana)
          </p>
        </div>
      </div>

      <button
        onClick={gerar}
        disabled={gerando || !prompt.trim()}
        className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        <ImagePlus size={12} strokeWidth={2} />
        {gerando ? "Gerando imagem…" : "Gerar imagem"}
      </button>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {imagemUrl && (
        <div className="space-y-2">
          <img
            src={imagemUrl}
            alt="Imagem gerada"
            className="max-h-96 rounded border border-neutral-200"
          />
          <a
            href={imagemUrl}
            download={`imagem-${formato}.png`}
            className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
          >
            <Download size={12} strokeWidth={2} />
            Baixar PNG
          </a>
        </div>
      )}
    </div>
  );
}
