"use client";

import { useState } from "react";
import { Bookmark, Check, Clock, ExternalLink, Play, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type GrupoAnalise = {
  id: number;
  titulo_grupo: string;
  resumo: string;
  sentimento: "positivo" | "negativo" | "neutro";
  relevancia: "alta" | "media" | "baixa";
  categoria_sugerida: string;
  mencoes: { indice: number; fonte: string; titulo_original: string }[];
};

type AnaliseIA = {
  resumo_executivo: string;
  total_mencoes: number;
  sentimento_geral: string;
  grupos: GrupoAnalise[];
  alertas: (string | { texto: string; categoria?: string })[];
};

type Snapshot = {
  id: string;
  total_mencoes: number;
  analise_ia: AnaliseIA | null;
  provedor_ia: string | null;
  erro: string | null;
  created_at: string;
};

function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

const SENTIMENTO_STYLE: Record<string, { bg: string; text: string }> = {
  positivo: { bg: "bg-emerald-50", text: "text-emerald-700" },
  negativo: { bg: "bg-red-50", text: "text-red-700" },
  neutro: { bg: "bg-neutral-100", text: "text-neutral-600" },
};

const OPCOES_INTERVALO = [
  { valor: 1, label: "1 hora" },
  { valor: 2, label: "2 horas" },
  { valor: 3, label: "3 horas" },
  { valor: 6, label: "6 horas" },
  { valor: 12, label: "12 horas" },
  { valor: 24, label: "24 horas" },
  { valor: null, label: "Desativado" },
];

export function UltimoSnapshot({
  snapshot,
  linksFlat = [],
  datesFlat = [],
  campanhaId,
  intervaloAtual,
  podeConfigurar,
}: {
  snapshot: Snapshot | null;
  linksFlat?: string[];
  datesFlat?: (string | null)[];
  campanhaId: string;
  intervaloAtual: number | null;
  podeConfigurar: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [aberto, setAberto] = useState(false);
  const [configAberta, setConfigAberta] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [intervalo, setIntervalo] = useState<number | null>(intervaloAtual);
  const [erro, setErro] = useState<string | null>(null);
  const [salvos, setSalvos] = useState<Set<string>>(new Set());

  async function salvarMencao(m: { indice: number; fonte: string; titulo_original: string }, categoriaSugerida: string) {
    const key = `${m.indice}`;
    if (salvos.has(key)) return;
    const url = linksFlat[m.indice] || null;
    const { error } = await supabase.from("monitoramento_itens").insert({
      campanha_id: campanhaId,
      categoria: categoriaSugerida || "outro",
      url,
      descricao: `${m.titulo_original} — Fonte: ${m.fonte}`,
    });
    if (!error) {
      setSalvos(new Set([...salvos, key]));
      router.refresh();
    }
  }

  async function executarAgora() {
    setExecutando(true);
    setErro(null);
    try {
      const res = await fetch("/api/monitoramento/snapshot", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setErro(data.error ?? data.erro ?? "erro ao executar busca");
        return;
      }
      router.refresh();
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setExecutando(false);
    }
  }

  async function salvarIntervalo(horas: number | null) {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/monitoramento/intervalo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horas }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao salvar intervalo");
        return;
      }
      setIntervalo(horas);
      setConfigAberta(false);
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  const analise = snapshot?.analise_ia ?? null;
  const dataFormatada = snapshot
    ? new Date(snapshot.created_at).toLocaleString("pt-BR")
    : null;

  const intervaloLabel =
    intervalo === null
      ? "Desativado"
      : OPCOES_INTERVALO.find((o) => o.valor === intervalo)?.label ?? `${intervalo}h`;

  return (
    <div className="rounded border border-neutral-200 p-3 space-y-3">
      {/* Header com controles */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Busca automática
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            <Clock size={11} className="inline -mt-px mr-1" />
            Frequência: {intervaloLabel}
            {dataFormatada && ` · Última: ${dataFormatada}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {podeConfigurar && (
            <button
              onClick={() => setConfigAberta(!configAberta)}
              className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              <Settings size={12} />
              Frequência
            </button>
          )}
          {podeConfigurar && (
            <button
              onClick={executarAgora}
              disabled={executando}
              className="flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play size={12} />
              {executando ? "Buscando…" : "Buscar agora"}
            </button>
          )}
        </div>
      </div>

      {/* Painel de configuração de intervalo */}
      {configAberta && (
        <div className="rounded bg-neutral-50 p-3 space-y-2">
          <p className="text-xs font-medium text-neutral-600">
            De quanto em quanto tempo o sistema deve buscar automaticamente?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {OPCOES_INTERVALO.map((op) => (
              <button
                key={op.valor ?? "off"}
                onClick={() => salvarIntervalo(op.valor)}
                disabled={salvando}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  intervalo === op.valor
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-neutral-300 text-neutral-600 hover:bg-indigo-50"
                } disabled:opacity-50`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {/* Snapshot vazio */}
      {!snapshot && (
        <p className="text-sm text-neutral-400 text-center py-2">
          Nenhuma busca automática realizada ainda. Clique em "Buscar agora" ou aguarde a próxima
          execução programada.
        </p>
      )}

      {/* Resultado do último snapshot */}
      {snapshot && snapshot.erro && (
        <p className="text-sm text-red-600">Erro na última busca: {snapshot.erro}</p>
      )}

      {snapshot && !snapshot.erro && !analise && (
        <div className="rounded bg-neutral-50 p-3 text-center">
          <p className="text-sm text-neutral-600">
            Busca realizada em {dataFormatada} — nenhuma menção encontrada.
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            Os termos monitorados não retornaram resultados neste ciclo. Isso é normal quando não há
            notícias ou publicações recentes sobre os termos cadastrados.
          </p>
        </div>
      )}

      {analise && (
        <>
          <div className="rounded bg-indigo-50 p-2">
            <p className="text-sm text-indigo-900">{analise.resumo_executivo}</p>
            <p className="text-xs text-indigo-600 mt-1">
              {snapshot!.total_mencoes} menções · Sentimento geral:{" "}
              <strong>{analise.sentimento_geral}</strong> · {analise.grupos.length} grupos
              {snapshot!.provedor_ia ? ` · ${snapshot!.provedor_ia}` : ""}
            </p>
          </div>

          {analise.alertas && analise.alertas.length > 0 && (
            <div className="rounded bg-red-50 p-2">
              <p className="text-xs font-semibold text-red-700 mb-1">Alertas</p>
              {analise.alertas.map((a, i) => (
                <p key={i} className="text-sm text-red-800">
                  • {typeof a === "string" ? a : a.texto}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={() => setAberto(!aberto)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {aberto ? "Recolher detalhes" : `Ver ${analise.grupos.length} grupos detalhados`}
          </button>

          {aberto && (
            <div className="space-y-2 pt-1">
              {analise.grupos.map((g) => {
                const sent = SENTIMENTO_STYLE[g.sentimento] ?? SENTIMENTO_STYLE.neutro;
                const borderColor =
                  g.sentimento === "negativo"
                    ? "border-l-red-400"
                    : g.sentimento === "positivo"
                      ? "border-l-emerald-400"
                      : "border-l-neutral-300";

                return (
                  <div
                    key={g.id}
                    className={`rounded border border-neutral-200 border-l-4 ${borderColor} p-2 space-y-1`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{g.titulo_grupo}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sent.bg} ${sent.text}`}
                      >
                        {g.sentimento}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {g.mencoes.length} fonte{g.mencoes.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">{g.resumo}</p>
                    {g.mencoes.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                        {g.mencoes.map((m, i) => {
                          const url = linksFlat[m.indice];
                          const rawDate = datesFlat[m.indice];
                          const dateLabel = rawDate ? formatDate(rawDate) : null;
                          const jaSalvo = salvos.has(`${m.indice}`);
                          return (
                            <span key={i} className="inline-flex items-center gap-1">
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                                  title={m.titulo_original}
                                >
                                  <ExternalLink size={10} />
                                  {m.fonte}
                                  {dateLabel && <span className="font-normal text-neutral-400">· {dateLabel}</span>}
                                </a>
                              ) : (
                                <span className="flex items-center gap-1 text-[11px] text-neutral-500" title={m.titulo_original}>
                                  <ExternalLink size={10} className="text-indigo-400" />
                                  {m.fonte}
                                  {dateLabel && <span className="text-neutral-400">· {dateLabel}</span>}
                                </span>
                              )}
                              {podeConfigurar && (
                                <button
                                  onClick={() => salvarMencao(m, g.categoria_sugerida)}
                                  disabled={jaSalvo}
                                  title={jaSalvo ? "Salvo" : "Salvar como item de monitoramento"}
                                  className={`rounded p-0.5 transition-colors ${jaSalvo ? "text-emerald-500" : "text-neutral-300 hover:text-indigo-600"}`}
                                >
                                  {jaSalvo ? <Check size={11} /> : <Bookmark size={11} />}
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
