"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Check, X, Tag, Image, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const TIPO_LABEL: Record<string, string> = {
  post: "Post",
  whatsapp: "WhatsApp",
  carrossel: "Carrossel",
  reel: "Reel / Vídeo curto",
  stories: "Stories",
  thread: "Thread (X)",
  roteiro_video: "Roteiro de vídeo",
  live: "Live",
  audio: "Áudio",
  video: "Vídeo",
  imagem: "Imagem",
  outro: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aprovado: "Aprovado",
  publicado: "Publicado",
  bloqueado_janela: "Bloqueado (janela)",
};

const ROTULO_PADRAO = "Conteúdo produzido com o auxílio de inteligência artificial.";

type Peca = {
  id: string;
  tipo: string;
  canal: string;
  conteudo: string | null;
  usou_ia: boolean;
  ferramenta: string | null;
  rotulo_aplicado: boolean;
  rotulo_texto: string | null;
  aprovador_id: string | null;
  status: string;
  publicado_em: string | null;
  created_at: string;
};

const TEMPLATES = [
  { value: "post_instagram", label: "Post Instagram (1080×1080)" },
  { value: "stories", label: "Stories (1080×1920)" },
  { value: "whatsapp", label: "WhatsApp (800×800)" },
  { value: "facebook", label: "Facebook (1200×630)" },
  { value: "twitter", label: "X / Twitter (1200×675)" },
];

export function PecaCard({
  peca,
  podeAprovar,
  podeCriar,
  currentUserId,
}: {
  peca: Peca;
  podeAprovar: boolean;
  podeCriar: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [aprovando, setAprovando] = useState(false);
  const [rotuloTexto, setRotuloTexto] = useState(ROTULO_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerandoArte, setGerandoArte] = useState(false);
  const [templateArte, setTemplateArte] = useState(TEMPLATES[0].value);
  const [corPrimaria, setCorPrimaria] = useState("#4f46e5");
  const [arteUrl, setArteUrl] = useState<string | null>(null);
  const [mostrarArte, setMostrarArte] = useState(false);

  const jaPublicada = peca.status === "publicado";
  const podeMostrarAcaoAprovar = podeAprovar && !jaPublicada;

  async function handleAprovar() {
    setErro(null);
    setCarregando(true);

    const update: Record<string, unknown> = {
      aprovador_id: currentUserId,
      status: "publicado",
      publicado_em: new Date().toISOString(),
    };
    if (peca.usou_ia) {
      update.rotulo_aplicado = true;
      update.rotulo_texto = rotuloTexto.trim();
    }

    const { error } = await supabase.from("pecas_conteudo").update(update).eq("id", peca.id);

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setAprovando(false);
    router.refresh();
  }

  return (
    <li className="rounded border border-neutral-200 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">
          {TIPO_LABEL[peca.tipo] ?? peca.tipo}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5">{peca.canal}</span>
        {peca.usou_ia && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
            IA{peca.ferramenta ? ` · ${peca.ferramenta}` : ""}
          </span>
        )}
        <span className="text-neutral-400">{STATUS_LABEL[peca.status] ?? peca.status}</span>
      </div>

      {peca.conteudo && (
        <div className="whitespace-pre-wrap rounded bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          {peca.conteudo}
        </div>
      )}

      {peca.rotulo_aplicado && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Tag size={12} strokeWidth={2} aria-hidden="true" className="inline-block shrink-0 align-middle" />{" "}
          {peca.rotulo_texto ?? ROTULO_PADRAO}
        </div>
      )}

      {jaPublicada && peca.publicado_em && (
        <p className="text-xs text-neutral-400">
          Publicado em {new Date(peca.publicado_em).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </p>
      )}

      {podeMostrarAcaoAprovar && !aprovando && (
        <button
          onClick={() => setAprovando(true)}
          className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50"
        >
          <CheckCircle2 size={12} strokeWidth={2} aria-hidden="true" />
          Aprovar e publicar
        </button>
      )}

      {podeCriar && peca.conteudo && (
        <div className="space-y-2">
          {!mostrarArte ? (
            <button
              onClick={() => setMostrarArte(true)}
              className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50"
            >
              <Image size={12} strokeWidth={2} />
              Gerar arte
            </button>
          ) : (
            <div className="space-y-2 rounded bg-indigo-50 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-medium text-neutral-500">Template</label>
                  <select
                    value={templateArte}
                    onChange={(e) => setTemplateArte(e.target.value)}
                    className="rounded border border-neutral-300 px-2 py-1 text-xs"
                  >
                    {TEMPLATES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-medium text-neutral-500">Cor primária</label>
                  <input
                    type="color"
                    value={corPrimaria}
                    onChange={(e) => setCorPrimaria(e.target.value)}
                    className="h-7 w-10 cursor-pointer rounded border border-neutral-300"
                  />
                </div>
                <button
                  onClick={async () => {
                    setGerandoArte(true);
                    setErro(null);
                    if (arteUrl) URL.revokeObjectURL(arteUrl);
                    try {
                      const res = await fetch("/api/pecas/gerar-arte", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          template: templateArte,
                          texto: peca.conteudo,
                          cor_primaria: corPrimaria,
                          peca_id: peca.id,
                        }),
                      });
                      if (!res.ok) {
                        const data = await res.json();
                        setErro(data.error ?? "Erro ao gerar arte");
                      } else {
                        const blob = await res.blob();
                        setArteUrl(URL.createObjectURL(blob));
                      }
                    } catch (e) {
                      setErro("Erro de rede ao gerar arte");
                    }
                    setGerandoArte(false);
                  }}
                  disabled={gerandoArte}
                  className="flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Image size={12} strokeWidth={2} />
                  {gerandoArte ? "Gerando…" : "Gerar"}
                </button>
                <button
                  onClick={() => {
                    setMostrarArte(false);
                    if (arteUrl) URL.revokeObjectURL(arteUrl);
                    setArteUrl(null);
                  }}
                  className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
                >
                  Fechar
                </button>
              </div>

              {arteUrl && (
                <div className="space-y-2">
                  <img
                    src={arteUrl}
                    alt="Arte gerada"
                    className="max-h-96 rounded border border-neutral-200"
                  />
                  <a
                    href={arteUrl}
                    download={`peca-${templateArte}.png`}
                    className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
                  >
                    <Download size={12} strokeWidth={2} />
                    Baixar PNG
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {podeMostrarAcaoAprovar && aprovando && (
        <div className="space-y-2 rounded bg-neutral-50 p-3">
          {peca.usou_ia && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-500">Texto do rótulo</label>
              <textarea
                rows={2}
                value={rotuloTexto}
                onChange={(e) => setRotuloTexto(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
          )}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAprovar}
              disabled={carregando}
              className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              {carregando ? "Publicando…" : "Confirmar"}
            </button>
            <button
              onClick={() => {
                setAprovando(false);
                setErro(null);
              }}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
