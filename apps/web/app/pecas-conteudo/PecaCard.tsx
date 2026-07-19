"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const TIPO_LABEL: Record<string, string> = {
  post: "Post",
  whatsapp: "WhatsApp",
  carrossel: "Carrossel",
  roteiro_video: "Roteiro de vídeo",
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
  usou_ia: boolean;
  ferramenta: string | null;
  rotulo_aplicado: boolean;
  rotulo_texto: string | null;
  aprovador_id: string | null;
  status: string;
  publicado_em: string | null;
  created_at: string;
};

export function PecaCard({
  peca,
  podeAprovar,
  currentUserId,
}: {
  peca: Peca;
  podeAprovar: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [aprovando, setAprovando] = useState(false);
  const [rotuloTexto, setRotuloTexto] = useState(ROTULO_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

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

      {peca.rotulo_aplicado && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          🏷️ {peca.rotulo_texto ?? ROTULO_PADRAO}
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
