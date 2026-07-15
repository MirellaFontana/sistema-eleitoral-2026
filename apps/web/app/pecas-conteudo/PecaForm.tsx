"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TIPOS = [
  { value: "post", label: "Post" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "carrossel", label: "Carrossel" },
  { value: "roteiro_video", label: "Roteiro de vídeo" },
  { value: "audio", label: "Áudio" },
  { value: "video", label: "Vídeo" },
  { value: "imagem", label: "Imagem" },
  { value: "outro", label: "Outro" },
];

const CANAIS = [
  { value: "site", label: "Site" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "radio", label: "Rádio" },
  { value: "tv", label: "TV" },
  { value: "outro", label: "Outro" },
];

export function PecaForm({ campanhaId, criadoPor }: { campanhaId: string; criadoPor: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [tipo, setTipo] = useState(TIPOS[0].value);
  const [canal, setCanal] = useState(CANAIS[0].value);
  const [usouIa, setUsouIa] = useState(false);
  const [ferramenta, setFerramenta] = useState("");
  const [prompt, setPrompt] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const { error } = await supabase.from("pecas_conteudo").insert({
      campanha_id: campanhaId,
      tipo,
      canal,
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
    setFerramenta("");
    setPrompt("");
    setUsouIa(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
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
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={usouIa} onChange={(e) => setUsouIa(e.target.checked)} />
        Gerado ou significativamente alterado por IA
      </label>

      {usouIa && (
        <div className="space-y-3 rounded bg-neutral-50 p-3">
          <p className="text-xs text-neutral-500">
            Peça com IA exige rótulo aplicado e aprovação antes de publicar — e não publica na
            janela de silêncio de 72h antes / 24h depois do pleito.
          </p>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Ferramenta/modelo usado</label>
            <input
              type="text"
              placeholder="ex.: claude-sonnet-5"
              value={ferramenta}
              onChange={(e) => setFerramenta(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Prompt/contexto usado (opcional)</label>
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {carregando ? "Criando…" : "Criar rascunho"}
      </button>
    </form>
  );
}
