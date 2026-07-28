"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Liderança de campo (legado)",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
  apoio_marketing: "Apoio de marketing",
  apoio_campanha: "Apoio de campanha",
  apoio_coordenacao: "Apoio de coordenação",
};

const CATEGORIA_LABEL: Record<string, string> = {
  ameaca_juridica: "Ameaça jurídica",
  deepfake_suspeito: "Deepfake suspeito",
  gestao_crise: "Gestão de crise",
};

const GRAVIDADE_LABEL: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };

type Alerta = {
  id: string;
  destinatarioPapel: string;
  canal: string;
  statusEnvio: string;
  lidoEm: string | null;
  encaminhadoPor: string | null;
  encaminhadoPorNome: string | null;
  encaminhadoEm: string | null;
  encaminhadoNota: string | null;
  createdAt: string;
  itemDescricao: string;
  itemCategoria: string;
  itemGravidade: string | null;
  itemUrl: string | null;
  textoIA: string | null;
};

export function AlertaCard({
  alerta,
  podeEncaminhar,
  currentUserId,
}: {
  alerta: Alerta;
  podeEncaminhar: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [marcandoLido, setMarcandoLido] = useState(false);
  const [encaminhando, setEncaminhando] = useState(false);
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function marcarLido() {
    setMarcandoLido(true);
    await supabase.from("alertas").update({ lido_em: new Date().toISOString() }).eq("id", alerta.id);
    setMarcandoLido(false);
    router.refresh();
  }

  async function confirmarEncaminhamento() {
    setErro(null);
    setCarregando(true);
    const { error } = await supabase
      .from("alertas")
      .update({
        encaminhado_por: currentUserId,
        encaminhado_em: new Date().toISOString(),
        encaminhado_nota: nota.trim() || null,
      })
      .eq("id", alerta.id);
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEncaminhando(false);
    router.refresh();
  }

  const jaEncaminhado = !!alerta.encaminhadoEm;
  const isAlertaIA = !!alerta.textoIA;

  return (
    <li className="space-y-2 rounded border border-red-200 bg-red-50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {isAlertaIA ? (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 font-medium text-white">
            Alerta da IA
          </span>
        ) : (
          <span className="rounded-full bg-red-600 px-2 py-0.5 font-medium text-white">
            {CATEGORIA_LABEL[alerta.itemCategoria] ?? alerta.itemCategoria}
          </span>
        )}
        {alerta.itemGravidade && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">
            Gravidade: {GRAVIDADE_LABEL[alerta.itemGravidade] ?? alerta.itemGravidade}
          </span>
        )}
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
          Pra: {PAPEL_LABEL[alerta.destinatarioPapel] ?? alerta.destinatarioPapel}
        </span>
        {alerta.lidoEm ? (
          <span className="text-neutral-400">Lido</span>
        ) : (
          <span className="font-medium text-red-700">Não lido</span>
        )}
      </div>

      <p className="text-sm">{isAlertaIA ? alerta.textoIA : alerta.itemDescricao}</p>

      {alerta.itemUrl && (
        <a
          href={alerta.itemUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-neutral-900 underline underline-offset-2"
        >
          Abrir link
        </a>
      )}

      {alerta.statusEnvio === "pendente_configuracao" && (
        <p className="flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />
          Envio por WhatsApp ainda não configurado — este alerta só existe dentro do sistema por
          enquanto.
        </p>
      )}
      {alerta.statusEnvio === "falhou" && (
        <p className="flex items-center gap-1 text-xs text-red-700">
          <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />
          Falha ao enviar por WhatsApp.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!alerta.lidoEm && (
          <button
            onClick={marcarLido}
            disabled={marcandoLido}
            className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            {marcandoLido ? "Marcando…" : "Marcar como lido"}
          </button>
        )}

        {podeEncaminhar && !jaEncaminhado && !encaminhando && (
          <button
            onClick={() => setEncaminhando(true)}
            className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
          >
            Marcar encaminhamento à Justiça Eleitoral
          </button>
        )}
      </div>

      {podeEncaminhar && !jaEncaminhado && encaminhando && (
        <div className="space-y-2 rounded bg-white p-3">
          <label className="block text-xs font-medium text-neutral-500">
            Nota (opcional — ex.: número de processo)
          </label>
          <textarea
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button
              onClick={confirmarEncaminhamento}
              disabled={carregando}
              className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              {carregando ? "Salvando…" : "Confirmar"}
            </button>
            <button
              onClick={() => setEncaminhando(false)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {jaEncaminhado && (
        <div className="flex items-start gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            Encaminhado à Justiça Eleitoral em{" "}
            {new Date(alerta.encaminhadoEm!).toLocaleString("pt-BR", { timeZone: "UTC" })}
            {alerta.encaminhadoPorNome ? ` por ${alerta.encaminhadoPorNome}` : ""}.
            {alerta.encaminhadoNota && (
              <span className="block text-emerald-800">Nota: {alerta.encaminhadoNota}</span>
            )}
          </span>
        </div>
      )}
    </li>
  );
}
