"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Star,
  AlertTriangle,
  Info,
} from "lucide-react";

type Rec = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  urgencia: string;
  fatos_utilizados: string | null;
  regras_aplicadas: string | null;
  fontes: string | null;
  confianca: string;
  limitacoes: string | null;
  status: string;
  decisao_texto: string | null;
  decidido_por: string | null;
  decidido_por_nome: { nome: string }[] | { nome: string } | null;
  decidido_em: string | null;
  acao_titulo: string | null;
  acao_responsavel: string | null;
  acao_responsavel_nome: { nome: string }[] | { nome: string } | null;
  acao_prazo: string | null;
  acao_descricao: string | null;
  resultado_texto: string | null;
  aprendizagem: string | null;
  avaliacao_qualidade: number | null;
  gerada_por_ia: boolean;
  provedor_ia: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_revisao: "Aguardando revisão",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  convertida_acao: "Convertida em ação",
  concluida: "Concluída",
  resultado_avaliado: "Resultado avaliado",
  arquivada: "Arquivada",
};

const STATUS_COR: Record<string, string> = {
  rascunho: "bg-neutral-100 text-neutral-600",
  aguardando_revisao: "bg-amber-100 text-amber-700",
  aprovada: "bg-green-100 text-green-700",
  rejeitada: "bg-red-100 text-red-700",
  convertida_acao: "bg-blue-100 text-blue-700",
  concluida: "bg-indigo-100 text-indigo-700",
  resultado_avaliado: "bg-purple-100 text-purple-700",
  arquivada: "bg-neutral-100 text-neutral-500",
};

const URGENCIA_COR: Record<string, string> = {
  critica: "bg-red-600 text-white",
  alta: "bg-orange-500 text-white",
  media: "bg-yellow-400 text-yellow-900",
  baixa: "bg-neutral-200 text-neutral-600",
};

const TIPO_LABELS: Record<string, string> = {
  comunicacao: "Comunicação",
  posicionamento: "Posicionamento",
  campo: "Campo",
  juridico: "Jurídico",
  oportunidade: "Oportunidade",
  risco: "Risco",
  operacional: "Operacional",
  geral: "Geral",
};

function nomeJoin(v: { nome: string }[] | { nome: string } | null): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.map((x) => x.nome).join(", ");
  return v.nome;
}

export function RecomendacoesClient({
  podeDecidir,
  podeGerar,
  membros,
}: {
  podeDecidir: boolean;
  podeGerar: boolean;
  membros: { id: string; nome: string }[];
}) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recomendacoes");
      const json = await res.json();
      setRecs(json.recomendacoes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function gerar() {
    setGerando(true);
    setErro("");
    try {
      const res = await fetch("/api/recomendacoes/gerar", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setErro(json.error ?? "Erro ao gerar"); return; }
      await carregar();
    } catch {
      setErro("Erro de conexão");
    } finally {
      setGerando(false);
    }
  }

  async function atualizar(id: string, campos: Record<string, unknown>) {
    const res = await fetch("/api/recomendacoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...campos }),
    });
    if (res.ok) await carregar();
  }

  const filtradas = filtroStatus === "todos"
    ? recs
    : recs.filter((r) => r.status === filtroStatus);

  const contagens = recs.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="flex-1 px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Lightbulb size={20} className="text-amber-500" />
            Recomendações
          </h1>
          <p className="text-sm text-neutral-500">
            Recomendações estratégicas da IA — revise, aprove e acompanhe resultados.
          </p>
        </div>
        {podeGerar && (
          <button
            onClick={gerar}
            disabled={gerando}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {gerando ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {gerando ? "Gerando…" : "Gerar novas recomendações"}
          </button>
        )}
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroStatus("todos")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filtroStatus === "todos" ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          Todos ({recs.length})
        </button>
        {Object.entries(STATUS_LABELS).map(([k, label]) =>
          contagens[k] ? (
            <button
              key={k}
              onClick={() => setFiltroStatus(k)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filtroStatus === k ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {label} ({contagens[k]})
            </button>
          ) : null
        )}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-neutral-400">Carregando…</p>
      ) : filtradas.length === 0 ? (
        <div className="py-12 text-center">
          <Lightbulb size={32} className="mx-auto mb-2 text-neutral-300" />
          <p className="text-sm text-neutral-500">
            {recs.length === 0
              ? "Nenhuma recomendação ainda. Clique em \"Gerar novas recomendações\" para começar."
              : "Nenhuma recomendação neste filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((rec) => (
            <RecCard
              key={rec.id}
              rec={rec}
              expandido={expandido === rec.id}
              onToggle={() => setExpandido(expandido === rec.id ? null : rec.id)}
              podeDecidir={podeDecidir}
              membros={membros}
              onAtualizar={atualizar}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function RecCard({
  rec,
  expandido,
  onToggle,
  podeDecidir,
  membros,
  onAtualizar,
}: {
  rec: Rec;
  expandido: boolean;
  onToggle: () => void;
  podeDecidir: boolean;
  membros: { id: string; nome: string }[];
  onAtualizar: (id: string, campos: Record<string, unknown>) => Promise<void>;
}) {
  const [decisaoTexto, setDecisaoTexto] = useState(rec.decisao_texto ?? "");
  const [acaoTitulo, setAcaoTitulo] = useState(rec.acao_titulo ?? "");
  const [acaoDesc, setAcaoDesc] = useState(rec.acao_descricao ?? "");
  const [acaoResp, setAcaoResp] = useState(rec.acao_responsavel ?? "");
  const [acaoPrazo, setAcaoPrazo] = useState(rec.acao_prazo ?? "");
  const [resultadoTexto, setResultadoTexto] = useState(rec.resultado_texto ?? "");
  const [aprendizagem, setAprendizagem] = useState(rec.aprendizagem ?? "");
  const [avaliacao, setAvaliacao] = useState(rec.avaliacao_qualidade ?? 0);
  const [salvando, setSalvando] = useState(false);

  async function salvar(campos: Record<string, unknown>) {
    setSalvando(true);
    try { await onAtualizar(rec.id, campos); } finally { setSalvando(false); }
  }

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white shadow-sm shadow-neutral-900/5">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className="mt-0.5 shrink-0">
          {rec.urgencia === "critica" ? (
            <AlertTriangle size={16} className="text-red-500" />
          ) : (
            <Lightbulb size={16} className="text-amber-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-800">{rec.titulo}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${URGENCIA_COR[rec.urgencia] ?? URGENCIA_COR.media}`}>
              {rec.urgencia}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COR[rec.status] ?? STATUS_COR.rascunho}`}>
              {STATUS_LABELS[rec.status] ?? rec.status}
            </span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              {TIPO_LABELS[rec.tipo] ?? rec.tipo}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{rec.descricao}</p>
        </div>
        <div className="shrink-0 text-neutral-400">
          {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expandido && (
        <div className="border-t border-neutral-100 px-4 pb-4">
          {/* Explicabilidade */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ExplBlock icon={<Info size={13} />} titulo="Fatos utilizados" texto={rec.fatos_utilizados} />
            <ExplBlock icon={<Info size={13} />} titulo="Regras aplicadas" texto={rec.regras_aplicadas} />
            <ExplBlock icon={<Info size={13} />} titulo="Fontes" texto={rec.fontes} />
            <ExplBlock icon={<AlertTriangle size={13} />} titulo="Limitações" texto={rec.limitacoes} />
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-400">
            <span>Confiança: <strong className="text-neutral-600">{rec.confianca}</strong></span>
            {rec.gerada_por_ia && <span>IA: {rec.provedor_ia ?? "?"}</span>}
            <span>{new Date(rec.created_at).toLocaleDateString("pt-BR")}</span>
          </div>

          {/* Decisão */}
          {podeDecidir && rec.status === "aguardando_revisao" && (
            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-2 text-xs font-semibold text-neutral-600">Decisão</p>
              <textarea
                value={decisaoTexto}
                onChange={(e) => setDecisaoTexto(e.target.value)}
                placeholder="Justificativa da decisão (opcional)…"
                rows={2}
                className="mb-2 w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  disabled={salvando}
                  onClick={() => salvar({ status: "aprovada", decisao_texto: decisaoTexto })}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle2 size={13} /> Aprovar
                </button>
                <button
                  disabled={salvando}
                  onClick={() => salvar({ status: "rejeitada", decisao_texto: decisaoTexto })}
                  className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircle size={13} /> Rejeitar
                </button>
              </div>
            </div>
          )}

          {rec.decisao_texto && (
            <div className="mt-3 text-xs text-neutral-500">
              <strong>Decisão:</strong> {rec.decisao_texto}
              {rec.decidido_por_nome && ` — ${nomeJoin(rec.decidido_por_nome)}`}
            </div>
          )}

          {/* Converter em ação */}
          {podeDecidir && rec.status === "aprovada" && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="mb-2 text-xs font-semibold text-blue-700">Converter em ação</p>
              <input
                value={acaoTitulo}
                onChange={(e) => setAcaoTitulo(e.target.value)}
                placeholder="Título da ação"
                className="mb-2 w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
              <textarea
                value={acaoDesc}
                onChange={(e) => setAcaoDesc(e.target.value)}
                placeholder="Descrição da ação"
                rows={2}
                className="mb-2 w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
              <div className="mb-2 flex gap-2">
                <select
                  value={acaoResp}
                  onChange={(e) => setAcaoResp(e.target.value)}
                  className="flex-1 rounded border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Responsável…</option>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={acaoPrazo}
                  onChange={(e) => setAcaoPrazo(e.target.value)}
                  className="rounded border border-neutral-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                disabled={salvando || !acaoTitulo.trim()}
                onClick={() =>
                  salvar({
                    status: "convertida_acao",
                    acao_titulo: acaoTitulo,
                    acao_descricao: acaoDesc,
                    acao_responsavel: acaoResp || null,
                    acao_prazo: acaoPrazo || null,
                  })
                }
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <ArrowRight size={13} /> Converter
              </button>
            </div>
          )}

          {rec.acao_titulo && (
            <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs">
              <p className="font-semibold text-neutral-600">Ação: {rec.acao_titulo}</p>
              {rec.acao_descricao && <p className="mt-1 text-neutral-500">{rec.acao_descricao}</p>}
              <div className="mt-1 flex gap-3 text-neutral-400">
                {rec.acao_responsavel_nome && <span>Responsável: {nomeJoin(rec.acao_responsavel_nome)}</span>}
                {rec.acao_prazo && <span>Prazo: {new Date(rec.acao_prazo + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
              </div>
            </div>
          )}

          {/* Criar decisão formal */}
          {podeDecidir && (rec.status === "aprovada" || rec.status === "convertida_acao") && (
            <button
              onClick={async () => {
                await fetch("/api/decisoes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    titulo: rec.titulo,
                    descricao: rec.descricao,
                    evidencias: [{ tipo: "recomendacao", id: rec.id, titulo: rec.titulo }],
                    recomendacao_id: rec.id,
                  }),
                });
                window.location.href = "/decisoes";
              }}
              className="mt-2 flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <ArrowRight size={13} /> Criar decisão formal
            </button>
          )}

          {/* Registrar resultado */}
          {podeDecidir && rec.status === "convertida_acao" && (
            <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="mb-2 text-xs font-semibold text-indigo-700">Registrar resultado</p>
              <textarea
                value={resultadoTexto}
                onChange={(e) => setResultadoTexto(e.target.value)}
                placeholder="O que aconteceu após a ação?"
                rows={2}
                className="mb-2 w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
              <button
                disabled={salvando || !resultadoTexto.trim()}
                onClick={() => salvar({ status: "concluida", resultado_texto: resultadoTexto })}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <CheckCircle2 size={13} /> Registrar
              </button>
            </div>
          )}

          {rec.resultado_texto && (
            <div className="mt-3 text-xs text-neutral-500">
              <strong>Resultado:</strong> {rec.resultado_texto}
            </div>
          )}

          {/* Avaliar qualidade */}
          {podeDecidir && rec.status === "concluida" && (
            <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3">
              <p className="mb-2 text-xs font-semibold text-purple-700">Avaliar qualidade da recomendação</p>
              <textarea
                value={aprendizagem}
                onChange={(e) => setAprendizagem(e.target.value)}
                placeholder="O que aprendemos? O que faríamos diferente?"
                rows={2}
                className="mb-2 w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
              <div className="mb-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setAvaliacao(n)}
                    className="p-0.5"
                  >
                    <Star
                      size={18}
                      className={n <= avaliacao ? "fill-amber-400 text-amber-400" : "text-neutral-300"}
                    />
                  </button>
                ))}
                <span className="ml-2 text-xs text-neutral-400">
                  {avaliacao > 0 ? `${avaliacao}/5` : "sem nota"}
                </span>
              </div>
              <button
                disabled={salvando || avaliacao === 0}
                onClick={() =>
                  salvar({
                    status: "resultado_avaliado",
                    aprendizagem: aprendizagem || null,
                    avaliacao_qualidade: avaliacao,
                  })
                }
                className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                <Star size={13} /> Avaliar
              </button>
            </div>
          )}

          {rec.avaliacao_qualidade && (
            <div className="mt-3 flex items-center gap-1 text-xs text-neutral-500">
              <strong>Avaliação:</strong>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={12}
                  className={n <= rec.avaliacao_qualidade! ? "fill-amber-400 text-amber-400" : "text-neutral-300"}
                />
              ))}
              {rec.aprendizagem && <span className="ml-2">— {rec.aprendizagem}</span>}
            </div>
          )}

          {/* Arquivar */}
          {podeDecidir && !["arquivada", "rascunho"].includes(rec.status) && (
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <button
                disabled={salvando}
                onClick={() => salvar({ status: "arquivada" })}
                className="text-xs text-neutral-400 hover:text-neutral-600"
              >
                Arquivar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExplBlock({
  icon,
  titulo,
  texto,
}: {
  icon: React.ReactNode;
  titulo: string;
  texto: string | null;
}) {
  if (!texto) return null;
  return (
    <div className="rounded-lg bg-neutral-50 p-2.5">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-neutral-500">
        {icon} {titulo}
      </div>
      <p className="text-xs text-neutral-600">{texto}</p>
    </div>
  );
}
