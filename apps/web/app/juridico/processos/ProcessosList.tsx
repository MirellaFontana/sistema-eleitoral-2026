"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Save,
  X,
  Plus,
  Lock,
  Link2,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

type Processo = {
  id: string;
  numero_processo: string | null;
  tipo: string;
  tribunal: string;
  status: string;
  titulo: string;
  descricao: string | null;
  parte_autora: string | null;
  parte_re: string | null;
  data_distribuicao: string | null;
  data_julgamento: string | null;
  resultado: string | null;
  created_at: string;
  prazos_processuais: Prazo[];
  provas_processo: ProvaLink[];
};

type Prazo = {
  id: string;
  titulo: string;
  data_limite: string;
  status: string;
  descricao: string | null;
};

type ProvaLink = {
  id: string;
  observacao: string | null;
  monitoramento_itens: {
    id: string;
    descricao: string;
    url: string | null;
    hash_evidencia: string | null;
    hash_calculado_em: string | null;
  };
};

type EvidenciaDisponivel = {
  id: string;
  descricao: string;
  hash_evidencia: string | null;
  hash_calculado_em: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  representacao: "Representação",
  aije: "AIJE",
  aime: "AIME",
  recurso: "Recurso",
  notificacao: "Notificação",
  outro: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  em_elaboracao: "Em elaboração",
  protocolado: "Protocolado",
  em_andamento: "Em andamento",
  aguardando_julgamento: "Aguardando julgamento",
  julgado: "Julgado",
  arquivado: "Arquivado",
};

const STATUS_COR: Record<string, string> = {
  em_elaboracao: "bg-neutral-100 text-neutral-700",
  protocolado: "bg-blue-100 text-blue-800",
  em_andamento: "bg-amber-100 text-amber-800",
  aguardando_julgamento: "bg-purple-100 text-purple-800",
  julgado: "bg-emerald-100 text-emerald-800",
  arquivado: "bg-neutral-100 text-neutral-500",
};

function PrazoItem({ p, podeEditar, onRemover }: { p: Prazo; podeEditar: boolean; onRemover: () => void }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const vencido = p.status === "pendente" && p.data_limite < hoje;
  const cumprido = p.status === "cumprido";

  return (
    <li className="flex items-center gap-2 text-xs">
      {cumprido ? (
        <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
      ) : vencido ? (
        <AlertTriangle size={13} className="shrink-0 text-red-500" />
      ) : (
        <Clock size={13} className="shrink-0 text-amber-500" />
      )}
      <span className={cumprido ? "line-through text-neutral-400" : vencido ? "font-medium text-red-700" : "text-neutral-700"}>
        {new Date(p.data_limite + "T12:00:00").toLocaleDateString("pt-BR")} — {p.titulo}
      </span>
      {p.descricao && <span className="text-neutral-400">({p.descricao})</span>}
      {podeEditar && (
        <button onClick={onRemover} className="ml-auto text-neutral-300 hover:text-red-500" title="Remover prazo">
          <X size={12} />
        </button>
      )}
    </li>
  );
}

function AddPrazoInline({ processoId, campanhaId, onAdded }: { processoId: string; campanhaId: string; onAdded: () => void }) {
  const supabase = createClient();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [dataLimite, setDataLimite] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!titulo.trim() || !dataLimite) return;
    setSalvando(true);
    await supabase.from("prazos_processuais").insert({
      processo_id: processoId,
      campanha_id: campanhaId,
      titulo: titulo.trim(),
      data_limite: dataLimite,
    });
    setSalvando(false);
    setTitulo("");
    setDataLimite("");
    setAberto(false);
    onAdded();
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700">
        <Plus size={11} /> Adicionar prazo
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título do prazo"
        className="rounded border border-neutral-300 px-2 py-1 text-xs"
      />
      <input
        type="date"
        value={dataLimite}
        onChange={(e) => setDataLimite(e.target.value)}
        className="rounded border border-neutral-300 px-2 py-1 text-xs"
      />
      <button
        onClick={salvar}
        disabled={salvando || !titulo.trim() || !dataLimite}
        className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {salvando ? "…" : "Salvar"}
      </button>
      <button onClick={() => setAberto(false)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancelar</button>
    </div>
  );
}

function AnexarProva({
  processoId,
  campanhaId,
  evidencias,
  jaAnexadas,
  onAnexado,
}: {
  processoId: string;
  campanhaId: string;
  evidencias: EvidenciaDisponivel[];
  jaAnexadas: Set<string>;
  onAnexado: () => void;
}) {
  const supabase = createClient();
  const [aberto, setAberto] = useState(false);
  const [selecionada, setSelecionada] = useState("");
  const [salvando, setSalvando] = useState(false);

  const disponiveis = evidencias.filter((e) => !jaAnexadas.has(e.id));

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700">
        <Link2 size={11} /> Anexar prova
      </button>
    );
  }

  if (disponiveis.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        Nenhuma evidência disponível.
        <button onClick={() => setAberto(false)} className="text-neutral-400 hover:text-neutral-600">Fechar</button>
      </div>
    );
  }

  async function anexar() {
    if (!selecionada) return;
    setSalvando(true);
    await supabase.from("provas_processo").insert({
      processo_id: processoId,
      monitoramento_item_id: selecionada,
      campanha_id: campanhaId,
    });
    setSalvando(false);
    setSelecionada("");
    setAberto(false);
    onAnexado();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select
        value={selecionada}
        onChange={(e) => setSelecionada(e.target.value)}
        className="max-w-xs rounded border border-neutral-300 px-2 py-1 text-xs"
      >
        <option value="">Selecionar evidência…</option>
        {disponiveis.map((e) => (
          <option key={e.id} value={e.id}>
            {e.descricao.slice(0, 80)}{e.descricao.length > 80 ? "…" : ""} {e.hash_evidencia ? " [lacrada]" : ""}
          </option>
        ))}
      </select>
      <button
        onClick={anexar}
        disabled={salvando || !selecionada}
        className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {salvando ? "…" : "Anexar"}
      </button>
      <button onClick={() => setAberto(false)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancelar</button>
    </div>
  );
}

function CardProcesso({
  p,
  campanhaId,
  podeEditar,
  evidencias,
  onAtualizar,
}: {
  p: Processo;
  campanhaId: string;
  podeEditar: boolean;
  evidencias: EvidenciaDisponivel[];
  onAtualizar: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [campos, setCampos] = useState({
    titulo: p.titulo,
    numero_processo: p.numero_processo ?? "",
    status: p.status,
    descricao: p.descricao ?? "",
    parte_autora: p.parte_autora ?? "",
    parte_re: p.parte_re ?? "",
    data_distribuicao: p.data_distribuicao ?? "",
    resultado: p.resultado ?? "",
  });

  const jaAnexadas = new Set(p.provas_processo.map((pp) => pp.monitoramento_itens.id));

  async function salvar() {
    setSalvando(true);
    await supabase
      .from("processos_eleitorais")
      .update({
        titulo: campos.titulo,
        numero_processo: campos.numero_processo.trim() || null,
        status: campos.status,
        descricao: campos.descricao.trim() || null,
        parte_autora: campos.parte_autora.trim() || null,
        parte_re: campos.parte_re.trim() || null,
        data_distribuicao: campos.data_distribuicao || null,
        resultado: campos.resultado.trim() || null,
      })
      .eq("id", p.id);
    setSalvando(false);
    setEditando(false);
    router.refresh();
  }

  async function excluir() {
    if (!confirm(`Excluir processo "${p.titulo}"? Prazos e provas vinculadas serão removidos.`)) return;
    await supabase.from("processos_eleitorais").delete().eq("id", p.id);
    onAtualizar();
  }

  async function removerPrazo(prazoId: string) {
    await supabase.from("prazos_processuais").delete().eq("id", prazoId);
    router.refresh();
  }

  async function togglePrazo(prazo: Prazo) {
    const novoStatus = prazo.status === "pendente" ? "cumprido" : "pendente";
    await supabase.from("prazos_processuais").update({ status: novoStatus }).eq("id", prazo.id);
    router.refresh();
  }

  async function desanexarProva(provaProcessoId: string) {
    await supabase.from("provas_processo").delete().eq("id", provaProcessoId);
    router.refresh();
  }

  const prazosOrdenados = [...p.prazos_processuais].sort(
    (a, b) => a.data_limite.localeCompare(b.data_limite)
  );

  return (
    <li className="rounded border border-neutral-200 overflow-hidden">
      <button
        onClick={() => setAberto(!aberto)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-neutral-50"
      >
        {aberto ? <ChevronDown size={14} className="shrink-0 text-neutral-400" /> : <ChevronRight size={14} className="shrink-0 text-neutral-400" />}
        <span className="min-w-0 flex-1">
          <span className="text-sm font-medium">{p.titulo}</span>
          {p.numero_processo && <span className="ml-2 text-xs text-neutral-400">({p.numero_processo})</span>}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COR[p.status] ?? "bg-neutral-100"}`}>
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
          {TIPO_LABEL[p.tipo] ?? p.tipo}
        </span>
        <span className="shrink-0 text-[10px] text-neutral-400">{p.tribunal}</span>
      </button>

      {aberto && (
        <div className="border-t border-neutral-100 px-4 py-3 space-y-4">
          {editando ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-neutral-500">Título</label>
                <input value={campos.titulo} onChange={(e) => setCampos({ ...campos, titulo: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-neutral-500">Nº processo</label>
                  <input value={campos.numero_processo} onChange={(e) => setCampos({ ...campos, numero_processo: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-neutral-500">Status</label>
                  <select value={campos.status} onChange={(e) => setCampos({ ...campos, status: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm">
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-neutral-500">Data distribuição</label>
                  <input type="date" value={campos.data_distribuicao} onChange={(e) => setCampos({ ...campos, data_distribuicao: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-neutral-500">Parte autora</label>
                  <input value={campos.parte_autora} onChange={(e) => setCampos({ ...campos, parte_autora: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-neutral-500">Parte ré</label>
                  <input value={campos.parte_re} onChange={(e) => setCampos({ ...campos, parte_re: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-neutral-500">Descrição</label>
                <textarea rows={3} value={campos.descricao} onChange={(e) => setCampos({ ...campos, descricao: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-neutral-500">Resultado</label>
                <textarea rows={2} value={campos.resultado} onChange={(e) => setCampos({ ...campos, resultado: e.target.value })} placeholder="Preencher após julgamento" className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={salvar} disabled={salvando || !campos.titulo.trim()} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  <Save size={12} /> {salvando ? "Salvando…" : "Salvar"}
                </button>
                <button onClick={() => setEditando(false)} className="flex items-center gap-1 rounded bg-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-300">
                  <X size={12} /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {p.descricao && <p className="text-sm text-neutral-600 whitespace-pre-wrap">{p.descricao}</p>}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
                {p.parte_autora && <span>Autora: <span className="text-neutral-700">{p.parte_autora}</span></span>}
                {p.parte_re && <span>Ré: <span className="text-neutral-700">{p.parte_re}</span></span>}
                {p.data_distribuicao && <span>Distribuição: <span className="text-neutral-700">{new Date(p.data_distribuicao + "T12:00:00").toLocaleDateString("pt-BR")}</span></span>}
                {p.resultado && <span>Resultado: <span className="text-neutral-700">{p.resultado}</span></span>}
              </div>

              {podeEditar && (
                <div className="flex gap-2">
                  <button onClick={() => setEditando(true)} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700">
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={excluir} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600">
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              )}
            </>
          )}

          {/* Prazos processuais */}
          <div className="space-y-2">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <CalendarClock size={12} /> Prazos processuais
            </p>
            {prazosOrdenados.length === 0 && <p className="text-xs text-neutral-300">Nenhum prazo cadastrado.</p>}
            <ul className="space-y-1">
              {prazosOrdenados.map((pr) => (
                <li key={pr.id} className="flex items-center gap-2">
                  {podeEditar && (
                    <button onClick={() => togglePrazo(pr)} className="shrink-0" title={pr.status === "pendente" ? "Marcar cumprido" : "Voltar a pendente"}>
                      <PrazoItem p={pr} podeEditar={false} onRemover={() => {}} />
                    </button>
                  )}
                  {!podeEditar && <PrazoItem p={pr} podeEditar={false} onRemover={() => {}} />}
                  {podeEditar && (
                    <button onClick={() => removerPrazo(pr.id)} className="text-neutral-300 hover:text-red-500" title="Remover">
                      <X size={11} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {podeEditar && <AddPrazoInline processoId={p.id} campanhaId={campanhaId} onAdded={() => router.refresh()} />}
          </div>

          {/* Provas vinculadas */}
          <div className="space-y-2">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <Lock size={12} /> Provas vinculadas
            </p>
            {p.provas_processo.length === 0 && <p className="text-xs text-neutral-300">Nenhuma prova anexada.</p>}
            <ul className="space-y-1">
              {p.provas_processo.map((pp) => (
                <li key={pp.id} className="flex items-start gap-2 text-xs">
                  <Lock size={11} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span className="min-w-0 flex-1">
                    <span className="text-neutral-700">{pp.monitoramento_itens.descricao}</span>
                    {pp.monitoramento_itens.hash_evidencia && (
                      <span className="ml-1 font-mono text-[10px] text-neutral-400">
                        SHA: {pp.monitoramento_itens.hash_evidencia.slice(0, 12)}…
                      </span>
                    )}
                    {pp.observacao && <span className="ml-1 text-neutral-400">— {pp.observacao}</span>}
                  </span>
                  {podeEditar && (
                    <button onClick={() => desanexarProva(pp.id)} className="shrink-0 text-neutral-300 hover:text-red-500" title="Desanexar">
                      <X size={11} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {podeEditar && (
              <AnexarProva
                processoId={p.id}
                campanhaId={campanhaId}
                evidencias={evidencias}
                jaAnexadas={jaAnexadas}
                onAnexado={() => router.refresh()}
              />
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function ProcessosList({
  processos,
  campanhaId,
  podeEditar,
  evidencias,
}: {
  processos: Processo[];
  campanhaId: string;
  podeEditar: boolean;
  evidencias: EvidenciaDisponivel[];
}) {
  const router = useRouter();
  const [lista, setLista] = useState(processos);

  function handleExcluir(id: string) {
    setLista((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <>
      {lista.length === 0 && <p className="text-sm text-neutral-400">Nenhum processo registrado ainda.</p>}
      <ul className="space-y-2">
        {lista.map((p) => (
          <CardProcesso
            key={p.id}
            p={p}
            campanhaId={campanhaId}
            podeEditar={podeEditar}
            evidencias={evidencias}
            onAtualizar={() => {
              handleExcluir(p.id);
              router.refresh();
            }}
          />
        ))}
      </ul>
    </>
  );
}
