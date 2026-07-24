"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const TIPOS = [
  { value: "post", label: "Post" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "carrossel", label: "Carrossel" },
  { value: "reel", label: "Reel / Vídeo curto" },
  { value: "stories", label: "Stories" },
  { value: "thread", label: "Thread (X)" },
  { value: "roteiro_video", label: "Roteiro de vídeo" },
  { value: "live", label: "Live" },
  { value: "audio", label: "Áudio" },
  { value: "video", label: "Vídeo" },
  { value: "imagem", label: "Imagem" },
  { value: "outro", label: "Outro" },
];

const CANAIS = [
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "X / Twitter" },
  { value: "site", label: "Site" },
  { value: "radio", label: "Rádio" },
  { value: "tv", label: "TV" },
  { value: "outro", label: "Outro" },
];

export function PecaForm({ campanhaId, criadoPor }: { campanhaId: string; criadoPor: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [tipo, setTipo] = useState(TIPOS[0].value);
  const [canal, setCanal] = useState(CANAIS[0].value);
  const [foco, setFoco] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [usouIa, setUsouIa] = useState(false);
  const [ferramenta, setFerramenta] = useState("");
  const [prompt, setPrompt] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);

  async function gerarComIa() {
    setErro(null);
    setGerando(true);

    const res = await fetch("/api/marketing/sugestao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formato: tipo, foco: foco.trim() || undefined }),
    });
    const data = await res.json();
    setGerando(false);

    if (!res.ok) {
      setErro(data.error ?? "Erro ao gerar conteúdo");
      return;
    }

    setConteudo(data.sugestao);
    setUsouIa(true);
    setFerramenta("Claude (Anthropic)");
    setPrompt(foco.trim() || "(gerado a partir da base de conhecimento)");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const { error } = await supabase.from("pecas_conteudo").insert({
      campanha_id: campanhaId,
      tipo,
      canal,
      conteudo: conteudo.trim() || null,
      usou_ia: usouIa,
      ferramenta: usouIa && ferramenta.trim() ? ferramenta.trim() : null,
      prompt: usouIa && prompt.trim() ? prompt.trim() : null,
      criado_por: criadoPor,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso("Rascunho criado.");
    setConteudo("");
    setFoco("");
    setFerramenta("");
    setPrompt("");
    setUsouIa(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Formato</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Canal</label>
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {CANAIS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">
            Tema / foco (opcional)
          </label>
          <input
            type="text"
            placeholder="Ex.: saúde pública, educação..."
            value={foco}
            onChange={(e) => setFoco(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-neutral-500">Conteúdo da peça</label>
          <button
            type="button"
            onClick={gerarComIa}
            disabled={gerando}
            className="flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Sparkles size={12} strokeWidth={2} />
            {gerando ? "Gerando…" : "Gerar com IA"}
          </button>
        </div>
        <textarea
          rows={8}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="Escreva o conteúdo ou clique em 'Gerar com IA' para criar automaticamente a partir das propostas da campanha."
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {usouIa && (
        <div className="space-y-3 rounded bg-amber-50 p-3">
          <p className="text-xs text-amber-700">
            Peça gerada com IA — exige rótulo e aprovação antes de publicar.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-500">Ferramenta/modelo</label>
              <input
                type="text"
                value={ferramenta}
                onChange={(e) => setFerramenta(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-500">Prompt / contexto</label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={usouIa} onChange={(e) => setUsouIa(e.target.checked)} />
        Gerado ou significativamente alterado por IA
      </label>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Criando…" : "Criar rascunho"}
      </button>
    </form>
  );
}
