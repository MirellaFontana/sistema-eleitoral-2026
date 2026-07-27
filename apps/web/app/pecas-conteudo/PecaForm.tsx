"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
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
  const [conteudo, setConteudo] = useState("");
  const [arte, setArte] = useState<File | null>(null);
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

    if (!conteudo.trim() && !arte) {
      setErro("Adicione o texto da peça, uma imagem ou os dois.");
      return;
    }

    setCarregando(true);

    let artePath: string | null = null;
    let arteMime: string | null = null;

    if (arte) {
      const ext = arte.name.split(".").pop() || "bin";
      const path = `${campanhaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await supabase.storage.from("pecas-arte").upload(path, arte, {
        contentType: arte.type || "application/octet-stream",
        upsert: false,
      });
      if (up.error) {
        setCarregando(false);
        setErro(`Falha ao subir arquivo: ${up.error.message}`);
        return;
      }
      artePath = path;
      arteMime = arte.type || "application/octet-stream";
    }

    const { error } = await supabase.from("pecas_conteudo").insert({
      campanha_id: campanhaId,
      tipo,
      canal,
      conteudo: conteudo.trim() || null,
      arte_path: artePath,
      arte_mime: arteMime,
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

    setSucesso("Peça enviada. Use \"Revisar com IA\" no card para checar compliance.");
    setTimeout(() => setSucesso(null), 4000);
    setConteudo("");
    setArte(null);
    setFerramenta("");
    setPrompt("");
    setUsouIa(false);
    (document.getElementById("peca-arte-input") as HTMLInputElement | null)?.value &&
      ((document.getElementById("peca-arte-input") as HTMLInputElement).value = "");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <p className="text-xs text-neutral-500">
        Suba a peça pronta produzida pela equipe (imagem final e/ou texto). Depois clique em
        &quot;Revisar com IA&quot; no card para verificar se está em conformidade com a legislação
        eleitoral (número, nome de urna, CNPJ, coligação, selo IA).
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Arte da peça (PNG/JPG — opcional se a peça for só texto)
        </label>
        <label
          htmlFor="peca-arte-input"
          className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-50"
        >
          <Upload size={14} strokeWidth={2} />
          {arte ? arte.name : "Clique para selecionar imagem"}
        </label>
        <input
          id="peca-arte-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setArte(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Texto / legenda da peça (opcional se for só imagem)
        </label>
        <textarea
          rows={6}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="Cole aqui a copy, legenda ou roteiro que acompanha a peça."
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={usouIa} onChange={(e) => setUsouIa(e.target.checked)} />
        Peça gerada ou significativamente alterada por IA (exige rótulo antes de publicar)
      </label>

      {usouIa && (
        <div className="grid grid-cols-1 gap-3 rounded bg-amber-50 p-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Ferramenta/modelo</label>
            <input
              type="text"
              value={ferramenta}
              onChange={(e) => setFerramenta(e.target.value)}
              placeholder="Ex.: Midjourney, Gemini nano-banana"
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Prompt utilizado</label>
            <input
              type="text"
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
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Enviando…" : "Enviar peça"}
      </button>
    </form>
  );
}
