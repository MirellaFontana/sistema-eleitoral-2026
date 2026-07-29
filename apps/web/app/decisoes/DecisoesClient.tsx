"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, CheckCircle, Clock, Play, XCircle, FileText, ListChecks } from "lucide-react";

type Membro = { id: string; nome: string; papel: string };
type Evidencia = { tipo: string; id: string; titulo?: string; resumo?: string };

type Decisao = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  evidencias: Evidencia[];
  decisao_texto: string | null;
  decidida_por: string | null;
  decidida_em: string | null;
  acao_planejada: string | null;
  responsavel_id: string | null;
  prazo: string | null;
  resultado: string | null;
  resultado_registrado_em: string | null;
  recomendacao_id: string | null;
  registrado_por: string;
  created_at: string;
  registrado_por_nome: { nome: string } | null;
  responsavel_nome: { nome: string } | null;
};

const STATUS_ICON: Record<string, typeof Clock> = {
  rascunho: FileText,
  decidida: CheckCircle,
  em_execucao: Play,
  concluida: CheckCircle,
  cancelada: XCircle,
};

const STATUS_BADGE: Record<string, string> = {
  rascunho: "bg-neutral-100 text-neutral-600",
  decidida: "bg-blue-100 text-blue-700",
  em_execucao: "bg-amber-100 text-amber-700",
  concluida: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  decidida: "Decidida",
  em_execucao: "Em execução",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const FILTROS = ["todos", "rascunho", "decidida", "em_execucao", "concluida", "cancelada"] as const;

export function DecisoesClient({ podeDecidir, membros }: { podeDecidir: boolean; membros: Membro[] }) {
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>("todos");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const params = filtro !== "todos" ? `?status=${filtro}` : "";
    const res = await fetch(`/api/decisoes${params}`);
    const json = await res.json();
    setDecisoes(json.decisoes ?? []);
    setLoading(false);
  }, [filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Decisões</h1>
          <p className="text-sm text-neutral-500">
            Ciclo completo: evidência, decisão, ação e resultado.
          </p>
        </div>
        <button
          onClick={() => setCriando(!criando)}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={14} /> Nova
        </button>
      </div>

      {criando && <NovaDecisaoForm onCriada={() => { setCriando(false); carregar(); }} />}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filtro === f ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {f === "todos" ? "Todos" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-100" />)}
        </div>
      ) : decisoes.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma decisão registrada.</p>
      ) : (
        <div className="space-y-2">
          {decisoes.map((d) => (
            <DecisaoCard
              key={d.id}
              decisao={d}
              expandido={expandido === d.id}
              onToggle={() => setExpandido(expandido === d.id ? null : d.id)}
              podeDecidir={podeDecidir}
              membros={membros}
              onAtualizado={carregar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NovaDecisaoForm({ onCriada }: { onCriada: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSalvando(true);
    await fetch("/api/decisoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: titulo.trim(), descricao: descricao.trim() || null }),
    });
    setSalvando(false);
    setTitulo("");
    setDescricao("");
    onCriada();
  }

  return (
    <form onSubmit={salvar} className="mb-5 rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título da decisão"
        className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
        required
      />
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Contexto / descrição (opcional)"
        rows={2}
        className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={salvando}
        className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Registrar decisão"}
      </button>
    </form>
  );
}

function DecisaoCard({
  decisao: d,
  expandido,
  onToggle,
  podeDecidir,
  membros,
  onAtualizado,
}: {
  decisao: Decisao;
  expandido: boolean;
  onToggle: () => void;
  podeDecidir: boolean;
  membros: Membro[];
  onAtualizado: () => void;
}) {
  const Icon = STATUS_ICON[d.status] ?? Clock;

  async function atualizar(campos: Record<string, unknown>) {
    await fetch("/api/decisoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, ...campos }),
    });
    onAtualizado();
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        {expandido ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />}
        <Icon size={14} className="shrink-0 text-neutral-500" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{d.titulo}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[d.status]}`}>
          {STATUS_LABEL[d.status]}
        </span>
      </button>

      {expandido && (
        <div className="border-t border-neutral-100 px-4 py-3 space-y-3 text-sm">
          {d.descricao && <p className="text-neutral-600">{d.descricao}</p>}

          <p className="text-xs text-neutral-400">
            Por {d.registrado_por_nome?.nome ?? "—"} em{" "}
            {new Date(d.created_at).toLocaleDateString("pt-BR")}
          </p>

          {/* Evidências */}
          {d.evidencias.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500 uppercase tracking-wide">Evidências</p>
              <ul className="space-y-0.5">
                {d.evidencias.map((ev, i) => (
                  <li key={i} className="text-xs text-neutral-600">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium">{ev.tipo}</span>{" "}
                    {ev.titulo ?? ev.resumo ?? ev.id}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Decisão */}
          {d.status !== "rascunho" && d.decisao_texto && (
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500 uppercase tracking-wide">Decisão</p>
              <p className="text-neutral-700">{d.decisao_texto}</p>
            </div>
          )}

          {/* Ação planejada */}
          {d.acao_planejada && (
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500 uppercase tracking-wide">Ação planejada</p>
              <p className="text-neutral-700">{d.acao_planejada}</p>
              {d.responsavel_nome && <p className="text-xs text-neutral-400">Responsável: {d.responsavel_nome.nome}</p>}
              {d.prazo && <p className="text-xs text-neutral-400">Prazo: {new Date(d.prazo + "T12:00:00").toLocaleDateString("pt-BR")}</p>}
            </div>
          )}

          {/* Resultado */}
          {d.resultado && (
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500 uppercase tracking-wide">Resultado</p>
              <p className="text-neutral-700">{d.resultado}</p>
              {d.resultado_registrado_em && (
                <p className="text-xs text-neutral-400">Registrado em {new Date(d.resultado_registrado_em).toLocaleDateString("pt-BR")}</p>
              )}
            </div>
          )}

          {/* Workflow */}
          {d.status === "rascunho" && podeDecidir && (
            <DecidirForm onDecidir={(texto, acao, responsavel, prazo) =>
              atualizar({ status: "decidida", decisao_texto: texto, acao_planejada: acao || null, responsavel_id: responsavel || null, prazo: prazo || null })
            } membros={membros} />
          )}

          {d.status === "decidida" && podeDecidir && (
            <button onClick={() => atualizar({ status: "em_execucao" })} className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700">
              Iniciar execução
            </button>
          )}

          {d.status === "em_execucao" && (
            <ResultadoForm onRegistrar={(resultado) => atualizar({ status: "concluida", resultado })} />
          )}

          {["decidida", "em_execucao"].includes(d.status) && (
            <AcoesSection decisaoId={d.id} membros={membros} podeDecidir={podeDecidir} />
          )}

          {["rascunho", "decidida"].includes(d.status) && podeDecidir && (
            <button onClick={() => atualizar({ status: "cancelada" })} className="rounded bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-300">
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DecidirForm({ onDecidir, membros }: { onDecidir: (texto: string, acao: string, responsavel: string, prazo: string) => void; membros: Membro[] }) {
  const [texto, setTexto] = useState("");
  const [acao, setAcao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");

  return (
    <div className="space-y-2 rounded border border-blue-200 bg-blue-50 p-3">
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Qual a decisão?" rows={2} className="w-full rounded border border-neutral-300 px-2 py-1 text-sm" />
      <input value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="Ação planejada (opcional)" className="w-full rounded border border-neutral-300 px-2 py-1 text-sm" />
      <div className="flex gap-2">
        <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm">
          <option value="">Responsável (opcional)</option>
          {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm" />
      </div>
      <button
        onClick={() => { if (texto.trim()) onDecidir(texto.trim(), acao.trim(), responsavel, prazo); }}
        disabled={!texto.trim()}
        className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Decidir
      </button>
    </div>
  );
}

function ResultadoForm({ onRegistrar }: { onRegistrar: (resultado: string) => void }) {
  const [resultado, setResultado] = useState("");

  return (
    <div className="flex gap-2">
      <input value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="Qual foi o resultado?" className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm" />
      <button
        onClick={() => { if (resultado.trim()) onRegistrar(resultado.trim()); }}
        disabled={!resultado.trim()}
        className="shrink-0 rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        Concluir
      </button>
    </div>
  );
}

type Acao = {
  id: string;
  descricao: string;
  status: string;
  prazo: string | null;
  responsavel_nome: { nome: string } | null;
};

const ACAO_STATUS_BADGE: Record<string, string> = {
  pendente: "bg-neutral-100 text-neutral-600",
  em_andamento: "bg-amber-100 text-amber-700",
  concluida: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-600",
};

function AcoesSection({ decisaoId, membros, podeDecidir }: { decisaoId: string; membros: Membro[]; podeDecidir: boolean }) {
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [criando, setCriando] = useState(false);
  const [desc, setDesc] = useState("");
  const [resp, setResp] = useState("");
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/decisoes/${decisaoId}/acoes`);
    const json = await res.json();
    setAcoes(json.acoes ?? []);
    setLoaded(true);
  }, [decisaoId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.trim()) return;
    setSalvando(true);
    await fetch(`/api/decisoes/${decisaoId}/acoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao: desc.trim(), responsavel_id: resp || null, prazo: prazo || null }),
    });
    setSalvando(false);
    setDesc("");
    setResp("");
    setPrazo("");
    setCriando(false);
    carregar();
  }

  async function atualizarStatus(acaoId: string, status: string) {
    await fetch(`/api/decisoes/${decisaoId}/acoes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao_id: acaoId, status }),
    });
    carregar();
  }

  if (!loaded) return null;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <ListChecks size={12} className="text-neutral-500" />
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Ações ({acoes.length})</p>
        {podeDecidir && (
          <button onClick={() => setCriando(!criando)} className="ml-auto text-[10px] text-indigo-600 hover:text-indigo-700">
            + Adicionar
          </button>
        )}
      </div>

      {acoes.length > 0 && (
        <ul className="space-y-1 mb-2">
          {acoes.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded bg-neutral-50 px-2 py-1.5 text-xs">
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ACAO_STATUS_BADGE[a.status] ?? ""}`}>
                {a.status === "em_andamento" ? "Em andamento" : a.status.charAt(0).toUpperCase() + a.status.slice(1)}
              </span>
              <span className="min-w-0 flex-1 text-neutral-700">{a.descricao}</span>
              {a.responsavel_nome && <span className="shrink-0 text-neutral-400">{a.responsavel_nome.nome}</span>}
              {a.prazo && <span className="shrink-0 text-neutral-400">{new Date(a.prazo + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
              {a.status === "pendente" && (
                <button onClick={() => atualizarStatus(a.id, "em_andamento")} className="shrink-0 text-[10px] text-amber-600 hover:text-amber-700">Iniciar</button>
              )}
              {a.status === "em_andamento" && (
                <button onClick={() => atualizarStatus(a.id, "concluida")} className="shrink-0 text-[10px] text-green-600 hover:text-green-700">Concluir</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {criando && (
        <form onSubmit={criar} className="space-y-1.5 rounded border border-neutral-200 bg-neutral-50 p-2">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição da ação" className="w-full rounded border border-neutral-300 px-2 py-1 text-xs" required />
          <div className="flex gap-1.5">
            <select value={resp} onChange={(e) => setResp(e.target.value)} className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs">
              <option value="">Responsável</option>
              {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-xs" />
          </div>
          <button type="submit" disabled={salvando} className="rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {salvando ? "Salvando…" : "Adicionar ação"}
          </button>
        </form>
      )}
    </div>
  );
}
