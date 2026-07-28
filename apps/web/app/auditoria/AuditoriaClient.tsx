"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Shield,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
} from "lucide-react";

type Evento = {
  id: string;
  acao: string;
  tabela_afetada: string | null;
  entidade_id: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  created_at: string;
  usuario_id: string | null;
  usuarios_internos: { nome: string }[] | { nome: string } | null;
};

const TABELAS = [
  "usuarios_internos",
  "campanhas",
  "diretrizes_campanha",
  "diretrizes_posicoes",
  "recomendacoes",
  "alertas",
  "concorrentes",
  "tarefas",
  "monitoramento_itens",
  "temas_campanha",
  "prazos_eleitorais",
];

const ACAO_COR: Record<string, string> = {
  INSERT: "bg-green-100 text-green-700",
  UPDATE: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

const TABELA_LABEL: Record<string, string> = {
  usuarios_internos: "Usuários",
  campanhas: "Campanha",
  diretrizes_campanha: "Diretrizes",
  diretrizes_posicoes: "Posições",
  recomendacoes: "Recomendações",
  alertas: "Alertas",
  concorrentes: "Concorrentes",
  tarefas: "Tarefas",
  monitoramento_itens: "Monitoramento",
  temas_campanha: "Temas",
  prazos_eleitorais: "Prazos",
};

function nomeUsuario(v: { nome: string }[] | { nome: string } | null): string {
  if (!v) return "sistema";
  if (Array.isArray(v)) return v[0]?.nome ?? "sistema";
  return v.nome;
}

function extrairOp(acao: string): string {
  const idx = acao.indexOf(":");
  return idx >= 0 ? acao.slice(0, idx) : acao;
}

export function AuditoriaClient({
  membros,
}: {
  membros: { id: string; nome: string }[];
}) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  const [filtroTabela, setFiltroTabela] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("pagina", String(pagina));
    if (filtroTabela) params.set("tabela", filtroTabela);
    if (filtroUsuario) params.set("usuario", filtroUsuario);
    if (filtroAcao) params.set("acao", filtroAcao);
    if (filtroDe) params.set("de", new Date(filtroDe).toISOString());
    if (filtroAte) params.set("ate", new Date(filtroAte + "T23:59:59").toISOString());
    try {
      const res = await fetch(`/api/auditoria?${params}`);
      const json = await res.json();
      setEventos(json.eventos ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [pagina, filtroTabela, filtroUsuario, filtroAcao, filtroDe, filtroAte]);

  useEffect(() => { carregar(); }, [carregar]);

  function aplicarFiltros() {
    setPagina(1);
    carregar();
  }

  function limparFiltros() {
    setFiltroTabela("");
    setFiltroUsuario("");
    setFiltroAcao("");
    setFiltroDe("");
    setFiltroAte("");
    setPagina(1);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / 50));

  return (
    <main className="flex-1 px-6 py-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Shield size={20} className="text-indigo-500" />
          Trilha de Auditoria
        </h1>
        <p className="text-sm text-neutral-500">
          Registro imutável de todas as operações críticas da campanha.
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-4">
        <button
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
        >
          <Filter size={12} /> Filtros
          {mostrarFiltros ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {mostrarFiltros && (
          <div className="mt-2 grid grid-cols-2 gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">Tabela</label>
              <select
                value={filtroTabela}
                onChange={(e) => setFiltroTabela(e.target.value)}
                className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">Todas</option>
                {TABELAS.map((t) => (
                  <option key={t} value={t}>{TABELA_LABEL[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">Usuário</label>
              <select
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value)}
                className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">Todos</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">Ação</label>
              <select
                value={filtroAcao}
                onChange={(e) => setFiltroAcao(e.target.value)}
                className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">Todas</option>
                <option value="INSERT">Criação</option>
                <option value="UPDATE">Alteração</option>
                <option value="DELETE">Exclusão</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">De</label>
              <input
                type="date"
                value={filtroDe}
                onChange={(e) => setFiltroDe(e.target.value)}
                className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">Até</label>
              <input
                type="date"
                value={filtroAte}
                onChange={(e) => setFiltroAte(e.target.value)}
                className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <div className="col-span-full flex gap-2">
              <button
                onClick={aplicarFiltros}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Search size={12} /> Buscar
              </button>
              <button
                onClick={limparFiltros}
                className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
              >
                Limpar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contagem */}
      <p className="mb-3 text-xs text-neutral-400">
        {total} {total === 1 ? "registro" : "registros"}
        {total > 50 && ` · Página ${pagina} de ${totalPaginas}`}
      </p>

      {/* Lista */}
      {loading ? (
        <p className="py-8 text-center text-sm text-neutral-400">Carregando…</p>
      ) : eventos.length === 0 ? (
        <div className="py-12 text-center">
          <Shield size={32} className="mx-auto mb-2 text-neutral-300" />
          <p className="text-sm text-neutral-500">
            Nenhum registro de auditoria encontrado com estes filtros.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {eventos.map((ev) => (
            <EventoRow
              key={ev.id}
              evento={ev}
              expandido={expandido === ev.id}
              onToggle={() => setExpandido(expandido === ev.id ? null : ev.id)}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPagina(Math.max(1, pagina - 1))}
            disabled={pagina <= 1}
            className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-neutral-500">
            {pagina} / {totalPaginas}
          </span>
          <button
            onClick={() => setPagina(Math.min(totalPaginas, pagina + 1))}
            disabled={pagina >= totalPaginas}
            className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </main>
  );
}

function EventoRow({
  evento,
  expandido,
  onToggle,
}: {
  evento: Evento;
  expandido: boolean;
  onToggle: () => void;
}) {
  const op = extrairOp(evento.acao);
  const tabela = evento.tabela_afetada ?? "?";
  const nome = nomeUsuario(evento.usuarios_internos);
  const dt = new Date(evento.created_at);

  return (
    <div className="rounded-lg border border-neutral-200/70 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs"
      >
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${ACAO_COR[op] ?? "bg-neutral-100 text-neutral-600"}`}>
          {op}
        </span>
        <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
          {TABELA_LABEL[tabela] ?? tabela}
        </span>
        <span className="min-w-0 flex-1 truncate text-neutral-700">
          {resumoEvento(evento)}
        </span>
        <span className="shrink-0 text-neutral-400">{nome}</span>
        <span className="shrink-0 text-neutral-400">
          {dt.toLocaleDateString("pt-BR")} {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="shrink-0 text-neutral-300">
          {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expandido && (
        <div className="border-t border-neutral-100 px-4 py-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {evento.antes && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase text-red-400">Antes</p>
                <pre className="max-h-60 overflow-auto rounded bg-red-50 p-2 text-[11px] text-red-800">
                  {JSON.stringify(evento.antes, null, 2)}
                </pre>
              </div>
            )}
            {evento.depois && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase text-green-400">Depois</p>
                <pre className="max-h-60 overflow-auto rounded bg-green-50 p-2 text-[11px] text-green-800">
                  {JSON.stringify(evento.depois, null, 2)}
                </pre>
              </div>
            )}
          </div>
          {evento.antes && evento.depois && (
            <div className="mt-3">
              <p className="mb-1 text-[10px] font-semibold uppercase text-amber-500">Campos alterados</p>
              <div className="flex flex-wrap gap-1">
                {camposAlterados(evento.antes, evento.depois).map((campo) => (
                  <span key={campo} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    {campo}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="mt-2 text-[10px] text-neutral-300">ID: {evento.entidade_id ?? "—"}</p>
        </div>
      )}
    </div>
  );
}

function resumoEvento(ev: Evento): string {
  const op = extrairOp(ev.acao);
  const d = (op === "DELETE" ? ev.antes : ev.depois) as Record<string, unknown> | null;
  if (!d) return ev.acao;

  const nome = d.nome ?? d.titulo ?? d.titulo ?? d.acao_titulo ?? d.texto_ia ?? d.descricao;
  if (typeof nome === "string") return nome.slice(0, 80);

  if (d.papel && d.email) return `${d.email} (${d.papel})`;
  return ev.acao;
}

function camposAlterados(antes: Record<string, unknown>, depois: Record<string, unknown>): string[] {
  const campos: string[] = [];
  const ignorar = new Set(["updated_at"]);
  for (const key of Object.keys(depois)) {
    if (ignorar.has(key)) continue;
    if (JSON.stringify(antes[key]) !== JSON.stringify(depois[key])) {
      campos.push(key);
    }
  }
  return campos;
}
