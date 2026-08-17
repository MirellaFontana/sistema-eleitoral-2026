"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Eye,
  Shield,
  Lightbulb,
  MessageCircle,
  Upload,
  FileText,
} from "lucide-react";

type NarrativaConcorrente = {
  concorrente: string;
  posicao: string;
  ressonancia: string;
  sinais: string;
};

type TemaAnalise = {
  tema: string;
  narrativa_propria: {
    posicao: string;
    clareza: string;
    presenca: string;
    evidencias: string;
  };
  narrativas_concorrentes: NarrativaConcorrente[];
  ressonancia_propria: {
    nivel: string;
    sinais: string;
  };
  lacunas: string[];
  oportunidades: string[];
  perguntas_recorrentes: string[];
  consistencia: string;
};

type Analise = {
  id: string;
  analise: TemaAnalise[];
  resumo: string | null;
  provedor_ia: string | null;
  tipo: string;
  created_at: string;
};

const NIVEL_COR: Record<string, string> = {
  alta: "bg-green-100 text-green-700",
  media: "bg-amber-100 text-amber-700",
  baixa: "bg-red-100 text-red-700",
};

const NIVEL_BADGE: Record<string, string> = {
  alta: "bg-green-500",
  media: "bg-amber-400",
  baixa: "bg-red-400",
};

export function NarrativasClient({ podeAnalisar }: { podeAnalisar: boolean }) {
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [analiseAtiva, setAnaliseAtiva] = useState<string | null>(null);
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [textoRelatorio, setTextoRelatorio] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/narrativas");
      const json = await res.json();
      setAnalises(json.analises ?? []);
      if (json.analises?.length > 0) setAnaliseAtiva(json.analises[0].id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function analisar() {
    setGerando(true);
    setErro("");
    try {
      const res = await fetch("/api/narrativas/analisar", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setErro(json.error ?? "Erro ao analisar"); return; }
      await carregar();
    } catch {
      setErro("Erro de conexão");
    } finally {
      setGerando(false);
    }
  }

  async function enviarRelatorio() {
    if (!textoRelatorio.trim()) return;
    setEnviando(true);
    setErro("");
    try {
      const res = await fetch("/api/narrativas/relatorio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoRelatorio }),
      });
      const json = await res.json();
      if (!res.ok) { setErro(json.error ?? "Erro ao salvar relatório"); return; }
      setTextoRelatorio("");
      setMostrarUpload(false);
      await carregar();
    } catch {
      setErro("Erro de conexão");
    } finally {
      setEnviando(false);
    }
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setTextoRelatorio(text);
  }

  const atual = analises.find((a) => a.id === analiseAtiva);
  const temas = (atual?.analise ?? []) as TemaAnalise[];
  const isRelatorioManual = atual?.tipo === "relatorio_manual";

  return (
    <main className="flex-1 px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen size={20} className="text-indigo-500" />
            Narrativas e Ressonância
          </h1>
          <p className="text-sm text-neutral-500">
            Comparação de narrativas próprias vs concorrentes por tema, com sinais de ressonância.
          </p>
        </div>
        {podeAnalisar && (
          <div className="flex gap-2">
            <button
              onClick={() => setMostrarUpload(!mostrarUpload)}
              className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              <Upload size={14} />
              Carregar relatório
            </button>
            <button
              onClick={analisar}
              disabled={gerando}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {gerando ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {gerando ? "Analisando…" : "Nova análise"}
            </button>
          </div>
        )}
      </div>

      {mostrarUpload && podeAnalisar && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <FileText size={14} /> Carregar relatório pronto
          </h2>
          <p className="mb-3 text-xs text-neutral-500">
            Cole o texto do relatório abaixo ou importe um arquivo .txt/.md
          </p>
          <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50">
            <Upload size={12} />
            Importar arquivo (.txt, .md)
            <input
              type="file"
              accept=".txt,.md,.text"
              className="hidden"
              onChange={handleArquivo}
            />
          </label>
          <textarea
            value={textoRelatorio}
            onChange={(e) => setTextoRelatorio(e.target.value)}
            rows={12}
            placeholder="Cole aqui o conteúdo do relatório de narrativas…"
            className="w-full rounded-lg border border-neutral-200 p-3 text-sm leading-relaxed text-neutral-800 placeholder:text-neutral-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              {textoRelatorio.length > 0 ? `${textoRelatorio.length.toLocaleString("pt-BR")} caracteres` : ""}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => { setMostrarUpload(false); setTextoRelatorio(""); }}
                className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                onClick={enviarRelatorio}
                disabled={enviando || !textoRelatorio.trim()}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {enviando ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                {enviando ? "Salvando…" : "Salvar relatório"}
              </button>
            </div>
          </div>
        </div>
      )}

      {erro && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {analises.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {analises.map((a) => (
            <button
              key={a.id}
              onClick={() => setAnaliseAtiva(a.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                analiseAtiva === a.id
                  ? "bg-indigo-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {a.tipo === "relatorio_manual" ? <FileText size={10} /> : <Sparkles size={10} />}
              {new Date(a.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-neutral-400">Carregando…</p>
      ) : !atual ? (
        <div className="py-12 text-center">
          <BookOpen size={32} className="mx-auto mb-2 text-neutral-300" />
          <p className="text-sm text-neutral-500">
            Nenhuma análise de narrativas ainda. Clique em &quot;Nova análise&quot; para cruzar os
            dados ou &quot;Carregar relatório&quot; para importar uma análise pronta.
          </p>
        </div>
      ) : isRelatorioManual ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileText size={16} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-neutral-700">Relatório importado</h2>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
              manual
            </span>
          </div>
          <p className="mb-3 text-xs text-neutral-400">
            {new Date(atual.created_at).toLocaleString("pt-BR")}
          </p>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {atual.resumo}
          </div>
        </div>
      ) : (
        <>
          {atual.resumo && (
            <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-700">
                <TrendingUp size={14} /> Resumo executivo
              </h2>
              <p className="text-sm leading-relaxed text-indigo-900">{atual.resumo}</p>
              <p className="mt-2 text-xs text-indigo-400">
                {new Date(atual.created_at).toLocaleString("pt-BR")} · {atual.provedor_ia ?? "IA"}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {temas.map((tema, i) => (
              <TemaCard key={i} tema={tema} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function TemaCard({ tema }: { tema: TemaAnalise }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white shadow-sm shadow-neutral-900/5">
      <button
        onClick={() => setAberto(!aberto)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-800">{tema.tema}</h3>
            <NivelBadge label="Ressonância" nivel={tema.ressonancia_propria?.nivel} />
            <NivelBadge label="Clareza" nivel={tema.narrativa_propria?.clareza} />
            <NivelBadge label="Presença" nivel={tema.narrativa_propria?.presenca} />
            <NivelBadge label="Consistência" nivel={tema.consistencia} />
          </div>
          <p className="mt-1 text-xs text-neutral-500 line-clamp-1">
            {tema.narrativa_propria?.posicao ?? "Sem posição definida"}
          </p>
        </div>
        <div className="mt-1 shrink-0 text-neutral-400">
          {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {aberto && (
        <div className="border-t border-neutral-100 px-4 pb-4">
          {/* Narrativa própria */}
          <div className="mt-3 rounded-lg bg-indigo-50 p-3">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
              <Shield size={12} /> Narrativa própria
            </h4>
            <p className="text-xs text-indigo-900">{tema.narrativa_propria?.posicao}</p>
            {tema.narrativa_propria?.evidencias && (
              <p className="mt-1 text-xs text-indigo-600">
                <strong>Evidências:</strong> {tema.narrativa_propria.evidencias}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3">
              <span className="flex items-center gap-1 text-[11px] text-indigo-500">
                <Eye size={10} /> Presença: {tema.narrativa_propria?.presenca ?? "?"}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-indigo-500">
                <CheckCircle2 size={10} /> Clareza: {tema.narrativa_propria?.clareza ?? "?"}
              </span>
            </div>
          </div>

          {/* Ressonância própria */}
          <div className="mt-3 rounded-lg bg-green-50 p-3">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <TrendingUp size={12} /> Ressonância própria
            </h4>
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${NIVEL_BADGE[tema.ressonancia_propria?.nivel] ?? "bg-neutral-300"}`} />
              <span className="text-xs text-green-800">{tema.ressonancia_propria?.nivel ?? "?"}</span>
            </div>
            {tema.ressonancia_propria?.sinais && (
              <p className="mt-1 text-xs text-green-600">{tema.ressonancia_propria.sinais}</p>
            )}
          </div>

          {/* Concorrentes */}
          {tema.narrativas_concorrentes?.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
                <AlertTriangle size={12} /> Narrativas concorrentes
              </h4>
              <div className="space-y-2">
                {tema.narrativas_concorrentes.map((c, i) => (
                  <div key={i} className="rounded-lg bg-red-50 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-red-800">{c.concorrente}</span>
                      <NivelBadge label="Ressonância" nivel={c.ressonancia} />
                    </div>
                    <p className="mt-1 text-xs text-red-700">{c.posicao}</p>
                    {c.sinais && (
                      <p className="mt-1 text-[11px] text-red-500">Sinais: {c.sinais}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lacunas */}
          {tema.lacunas?.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                <AlertTriangle size={12} /> Lacunas
              </h4>
              <ul className="space-y-1">
                {tema.lacunas.map((l, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Oportunidades */}
          {tema.oportunidades?.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-600">
                <Lightbulb size={12} /> Oportunidades
              </h4>
              <ul className="space-y-1">
                {tema.oportunidades.map((o, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-green-700">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green-400" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Perguntas recorrentes */}
          {tema.perguntas_recorrentes?.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
                <MessageCircle size={12} /> Perguntas e objeções recorrentes
              </h4>
              <ul className="space-y-1">
                {tema.perguntas_recorrentes.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-neutral-600">
                    <HelpCircle size={10} className="mt-0.5 shrink-0 text-neutral-400" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NivelBadge({ label, nivel }: { label: string; nivel?: string }) {
  const n = nivel ?? "baixa";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${NIVEL_COR[n] ?? NIVEL_COR.baixa}`}>
      {label}: {n}
    </span>
  );
}
