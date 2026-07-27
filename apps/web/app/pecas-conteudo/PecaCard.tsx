"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Check, X, Tag, ShieldCheck, AlertTriangle, Sparkles } from "lucide-react";
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

type ItemChecagem = { item: string; presente: boolean; observacao?: string };
type RevisaoIA = {
  veredicto?: "CONFORME" | "ATENÇÃO" | "NÃO CONFORME";
  resumo?: string;
  itens?: ItemChecagem[];
  recomendacoes?: string[];
};

type Peca = {
  id: string;
  tipo: string;
  canal: string;
  conteudo: string | null;
  arte_path: string | null;
  arte_mime: string | null;
  usou_ia: boolean;
  ferramenta: string | null;
  rotulo_aplicado: boolean;
  rotulo_texto: string | null;
  revisao_ia_json: RevisaoIA | null;
  revisao_ia_em: string | null;
  aprovador_id: string | null;
  status: string;
  publicado_em: string | null;
  created_at: string;
};

const VEREDICTO_CLS: Record<string, string> = {
  CONFORME: "bg-green-100 text-green-800",
  "ATENÇÃO": "bg-yellow-100 text-yellow-800",
  "NÃO CONFORME": "bg-red-100 text-red-800",
};

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
  const [revisando, setRevisando] = useState(false);
  const [arteUrl, setArteUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    if (peca.arte_path) {
      supabase.storage
        .from("pecas-arte")
        .createSignedUrl(peca.arte_path, 600)
        .then(({ data }) => {
          if (!cancelado && data?.signedUrl) setArteUrl(data.signedUrl);
        });
    }
    return () => {
      cancelado = true;
    };
  }, [peca.arte_path, supabase]);

  const jaPublicada = peca.status === "publicado";
  const podeMostrarAcaoAprovar = podeAprovar && !jaPublicada;
  const revisao = peca.revisao_ia_json;

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

  async function handleRevisar() {
    setErro(null);
    setRevisando(true);
    try {
      const res = await fetch("/api/pecas/revisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peca_id: peca.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro ao revisar peça");
      } else {
        router.refresh();
      }
    } catch {
      setErro("Erro de rede ao revisar peça");
    }
    setRevisando(false);
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
        {revisao?.veredicto && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
              VEREDICTO_CLS[revisao.veredicto] ?? "bg-neutral-100 text-neutral-700"
            }`}
          >
            <ShieldCheck size={11} strokeWidth={2} />
            {revisao.veredicto}
          </span>
        )}
        <span className="text-neutral-400">{STATUS_LABEL[peca.status] ?? peca.status}</span>
      </div>

      {arteUrl && (
        <img
          src={arteUrl}
          alt="Arte da peça"
          className="max-h-96 rounded border border-neutral-200"
        />
      )}

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

      {revisao && (
        <div
          className={`space-y-2 rounded border p-3 text-xs ${
            revisao.veredicto === "CONFORME"
              ? "border-green-200 bg-green-50"
              : revisao.veredicto === "NÃO CONFORME"
                ? "border-red-200 bg-red-50"
                : "border-yellow-200 bg-yellow-50"
          }`}
        >
          {revisao.resumo && <p className="text-neutral-700">{revisao.resumo}</p>}
          {revisao.itens && revisao.itens.length > 0 && (
            <ul className="space-y-1">
              {revisao.itens.map((it, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  {it.presente ? (
                    <Check size={12} strokeWidth={3} className="mt-0.5 shrink-0 text-green-600" />
                  ) : (
                    <X size={12} strokeWidth={3} className="mt-0.5 shrink-0 text-red-600" />
                  )}
                  <span>
                    <strong>{it.item}</strong>
                    {it.observacao ? ` — ${it.observacao}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {revisao.recomendacoes && revisao.recomendacoes.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 font-semibold text-neutral-600">
                <AlertTriangle size={11} strokeWidth={2} />
                Recomendações
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-neutral-600">
                {revisao.recomendacoes.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {peca.revisao_ia_em && (
            <p className="text-[10px] text-neutral-400">
              Revisado em {new Date(peca.revisao_ia_em).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      )}

      {jaPublicada && peca.publicado_em && (
        <p className="text-xs text-neutral-400">
          Publicado em {new Date(peca.publicado_em).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {podeCriar && (
          <button
            onClick={handleRevisar}
            disabled={revisando}
            className="flex items-center gap-1 rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            <Sparkles size={12} strokeWidth={2} />
            {revisando ? "Revisando…" : revisao ? "Revisar novamente" : "Revisar com IA"}
          </button>
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
      </div>

      {aprovando && (
        <div className="space-y-2 rounded bg-neutral-50 p-3">
          {peca.usou_ia && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-500">
                Rótulo IA obrigatório
              </label>
              <input
                type="text"
                value={rotuloTexto}
                onChange={(e) => setRotuloTexto(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAprovar}
              disabled={carregando}
              className="flex items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Check size={12} strokeWidth={2} />
              {carregando ? "Publicando…" : "Confirmar publicação"}
            </button>
            <button
              onClick={() => setAprovando(false)}
              className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </li>
  );
}
