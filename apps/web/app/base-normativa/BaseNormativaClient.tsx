"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Scale,
  Plus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  ExternalLink,
  Trash2,
  Save,
} from "lucide-react";

type Dispositivo = {
  id: string;
  artigo: string | null;
  paragrafo: string | null;
  inciso: string | null;
  alinea: string | null;
  texto: string;
  tema: string | null;
  cargo: string | null;
  etapa: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  alterado_por: string | null;
  status: string;
  observacoes: string | null;
};

type Fonte = {
  id: string;
  autoridade: string;
  tipo: string;
  numero: string | null;
  ano: number | null;
  titulo: string;
  ementa: string | null;
  eleicao_ciclo: string | null;
  url_oficial: string | null;
  data_publicacao: string | null;
  data_verificacao: string | null;
  hash_conteudo: string | null;
  status: string;
  observacoes: string | null;
  alteracoes_resumo: string | null;
  dispositivos_normativos: Dispositivo[];
};

const STATUS_BADGE: Record<string, { label: string; cor: string; icon: typeof CheckCircle2 }> = {
  pendente: { label: "Pendente", cor: "bg-amber-100 text-amber-700", icon: Clock },
  validada: { label: "Validada", cor: "bg-green-100 text-green-700", icon: CheckCircle2 },
  desatualizada: { label: "Desatualizada", cor: "bg-orange-100 text-orange-700", icon: AlertTriangle },
  revogada: { label: "Revogada", cor: "bg-red-100 text-red-700", icon: XCircle },
};

const AUTORIDADE_LABEL: Record<string, string> = {
  tse: "TSE",
  congresso_nacional: "Congresso Nacional",
  presidencia: "Presidência",
  stf: "STF",
  tre: "TRE",
  anpd: "ANPD",
  outra: "Outra",
};

const TIPO_LABEL: Record<string, string> = {
  lei: "Lei",
  lei_complementar: "Lei Complementar",
  resolucao: "Resolução",
  constituicao: "Constituição Federal",
  decreto: "Decreto",
  instrucao_normativa: "Instrução Normativa",
  portaria: "Portaria",
  sumula: "Súmula",
  outra: "Outra",
};

export function BaseNormativaClient({ podeEditar }: { podeEditar: boolean }) {
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [novaFonte, setNovaFonte] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/base-normativa");
      const json = await res.json();
      setFontes(json.fontes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const validadas = fontes.filter((f) => f.status === "validada").length;
  const pendentes = fontes.filter((f) => f.status === "pendente").length;
  const totalDisp = fontes.reduce((s, f) => s + (f.dispositivos_normativos?.length ?? 0), 0);

  return (
    <main className="flex-1 px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Scale size={20} className="text-indigo-500" />
            Base Normativa Eleitoral
          </h1>
          <p className="text-sm text-neutral-500">
            Legislação estruturada com rastreabilidade e validação humana.
          </p>
        </div>
        {podeEditar && (
          <button
            onClick={() => setNovaFonte(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={14} /> Nova fonte normativa
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6 flex flex-wrap gap-4 text-xs text-neutral-500">
        <span>{fontes.length} {fontes.length === 1 ? "fonte" : "fontes"}</span>
        <span>{totalDisp} dispositivos</span>
        <span className="text-green-600">{validadas} validadas</span>
        {pendentes > 0 && <span className="text-amber-600">{pendentes} pendentes</span>}
      </div>

      {novaFonte && (
        <NovaFonteForm
          onSalvar={async () => { setNovaFonte(false); await carregar(); }}
          onCancelar={() => setNovaFonte(false)}
        />
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-neutral-400">Carregando…</p>
      ) : fontes.length === 0 ? (
        <div className="py-12 text-center">
          <Scale size={32} className="mx-auto mb-2 text-neutral-300" />
          <p className="text-sm text-neutral-500">
            Nenhuma fonte normativa cadastrada. Adicione leis, resoluções e normas do TSE.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fontes.map((fonte) => (
            <FonteCard
              key={fonte.id}
              fonte={fonte}
              expandido={expandido === fonte.id}
              onToggle={() => setExpandido(expandido === fonte.id ? null : fonte.id)}
              podeEditar={podeEditar}
              onRecarregar={carregar}
            />
          ))}
        </div>
      )}

      <p className="mt-8 text-[10px] text-neutral-300">
        Sabedoria assistiva — não substitui parecer jurídico. Toda análise cita a regra e sinaliza incerteza.
      </p>
    </main>
  );
}

function NovaFonteForm({
  onSalvar,
  onCancelar,
}: {
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const [campos, setCampos] = useState({
    autoridade: "tse",
    tipo: "lei",
    numero: "",
    ano: "",
    titulo: "",
    ementa: "",
    eleicao_ciclo: "",
    url_oficial: "",
    data_publicacao: "",
  });
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!campos.titulo.trim()) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/base-normativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...campos, ano: campos.ano ? parseInt(campos.ano) : null }),
      });
      if (res.ok) onSalvar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-indigo-700">Nova fonte normativa</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-neutral-500">Autoridade</label>
          <select value={campos.autoridade} onChange={(e) => setCampos({ ...campos, autoridade: e.target.value })} className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs">
            {Object.entries(AUTORIDADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-neutral-500">Tipo</label>
          <select value={campos.tipo} onChange={(e) => setCampos({ ...campos, tipo: e.target.value })} className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs">
            {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-neutral-500">Número</label>
          <input value={campos.numero} onChange={(e) => setCampos({ ...campos, numero: e.target.value })} placeholder="9.504" className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-neutral-500">Ano</label>
          <input value={campos.ano} onChange={(e) => setCampos({ ...campos, ano: e.target.value })} placeholder="1997" className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-neutral-500">Título *</label>
          <input value={campos.titulo} onChange={(e) => setCampos({ ...campos, titulo: e.target.value })} placeholder="Lei das Eleições" className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-neutral-500">Ciclo eleitoral</label>
          <input value={campos.eleicao_ciclo} onChange={(e) => setCampos({ ...campos, eleicao_ciclo: e.target.value })} placeholder="2026" className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-neutral-500">Data publicação</label>
          <input type="date" value={campos.data_publicacao} onChange={(e) => setCampos({ ...campos, data_publicacao: e.target.value })} className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs" />
        </div>
        <div className="col-span-full">
          <label className="mb-1 block text-[11px] font-medium text-neutral-500">Ementa</label>
          <textarea value={campos.ementa} onChange={(e) => setCampos({ ...campos, ementa: e.target.value })} rows={2} placeholder="Estabelece normas para as eleições…" className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs" />
        </div>
        <div className="col-span-full">
          <label className="mb-1 block text-[11px] font-medium text-neutral-500">URL oficial</label>
          <input value={campos.url_oficial} onChange={(e) => setCampos({ ...campos, url_oficial: e.target.value })} placeholder="https://www.planalto.gov.br/…" className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={salvar} disabled={salvando || !campos.titulo.trim()} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          <Save size={12} /> {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button onClick={onCancelar} className="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-300">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FonteCard({
  fonte,
  expandido,
  onToggle,
  podeEditar,
  onRecarregar,
}: {
  fonte: Fonte;
  expandido: boolean;
  onToggle: () => void;
  podeEditar: boolean;
  onRecarregar: () => void;
}) {
  const badge = STATUS_BADGE[fonte.status] ?? STATUS_BADGE.pendente;
  const BadgeIcon = badge.icon;
  const ref = [fonte.tipo ? (TIPO_LABEL[fonte.tipo] ?? fonte.tipo) : null, fonte.numero, fonte.ano ? `/${fonte.ano}` : null].filter(Boolean).join(" ");

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white shadow-sm shadow-neutral-900/5">
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left">
        <Scale size={16} className="mt-0.5 shrink-0 text-indigo-400" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-800">{fonte.titulo}</h3>
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">{ref}</span>
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">{AUTORIDADE_LABEL[fonte.autoridade] ?? fonte.autoridade}</span>
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cor}`}>
              <BadgeIcon size={10} /> {badge.label}
            </span>
          </div>
          {fonte.ementa && <p className="mt-1 text-xs text-neutral-500 line-clamp-1">{fonte.ementa}</p>}
          <div className="mt-1 flex gap-3 text-[10px] text-neutral-400">
            <span>{fonte.dispositivos_normativos?.length ?? 0} dispositivos</span>
            {fonte.url_oficial && <span className="flex items-center gap-0.5"><ExternalLink size={9} /> URL oficial</span>}
            {fonte.data_verificacao && <span>Verificada: {new Date(fonte.data_verificacao + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
          </div>
        </div>
        <div className="mt-1 shrink-0 text-neutral-400">
          {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expandido && (
        <div className="border-t border-neutral-100 px-4 pb-4">
          {fonte.url_oficial && (
            <a href={fonte.url_oficial} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
              <ExternalLink size={11} /> Abrir fonte oficial
            </a>
          )}
          {fonte.hash_conteudo && (
            <p className="mt-1 text-[10px] text-neutral-300">Hash: {fonte.hash_conteudo}</p>
          )}
          {fonte.observacoes && (
            <p className="mt-2 text-xs text-neutral-500">{fonte.observacoes}</p>
          )}

          {fonte.status === "desatualizada" && fonte.alteracoes_resumo && (
            <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-orange-700">
                <AlertTriangle size={12} />
                Alterações detectadas
              </div>
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-orange-900">
                {fonte.alteracoes_resumo}
              </div>
              {podeEditar && (
                <button
                  onClick={async () => {
                    await fetch("/api/base-normativa", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: fonte.id, status: "validada" }),
                    });
                    onRecarregar();
                  }}
                  className="mt-3 flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  <CheckCircle2 size={12} /> Revisado — marcar como validada
                </button>
              )}
            </div>
          )}

          {fonte.status === "desatualizada" && !fonte.alteracoes_resumo && podeEditar && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={async () => {
                  await fetch("/api/base-normativa", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: fonte.id, status: "validada" }),
                  });
                  onRecarregar();
                }}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <CheckCircle2 size={12} /> Marcar como validada
              </button>
            </div>
          )}

          {podeEditar && fonte.status === "pendente" && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={async () => {
                  await fetch("/api/base-normativa", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: fonte.id, status: "validada" }),
                  });
                  onRecarregar();
                }}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <CheckCircle2 size={12} /> Validar
              </button>
              <button
                onClick={async () => {
                  await fetch("/api/base-normativa", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: fonte.id, status: "desatualizada" }),
                  });
                  onRecarregar();
                }}
                className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
              >
                <AlertTriangle size={12} /> Marcar desatualizada
              </button>
            </div>
          )}

          {/* Dispositivos */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-neutral-600">Dispositivos</h4>
              {podeEditar && (
                <NovoDispositivoBtn fonteId={fonte.id} onSalvar={onRecarregar} />
              )}
            </div>
            {(fonte.dispositivos_normativos ?? []).length === 0 ? (
              <p className="text-xs text-neutral-400">Nenhum dispositivo cadastrado.</p>
            ) : (
              <div className="space-y-1.5">
                {fonte.dispositivos_normativos.map((d) => (
                  <DispositivoRow key={d.id} disp={d} podeEditar={podeEditar} onRecarregar={onRecarregar} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DispositivoRow({
  disp,
  podeEditar,
  onRecarregar,
}: {
  disp: Dispositivo;
  podeEditar: boolean;
  onRecarregar: () => void;
}) {
  const loc = [
    disp.artigo ? `Art. ${disp.artigo}` : null,
    disp.paragrafo ? `§${disp.paragrafo}` : null,
    disp.inciso ? `Inc. ${disp.inciso}` : null,
    disp.alinea ? `Al. ${disp.alinea}` : null,
  ].filter(Boolean).join(", ");

  const badge = STATUS_BADGE[disp.status] ?? STATUS_BADGE.pendente;

  return (
    <div className="rounded-lg bg-neutral-50 p-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {loc && <span className="font-mono text-[11px] font-semibold text-indigo-600">{loc}</span>}
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badge.cor}`}>{badge.label}</span>
            {disp.tema && <span className="rounded bg-neutral-200 px-1 py-0.5 text-[9px] text-neutral-500">{disp.tema}</span>}
            {disp.cargo && <span className="rounded bg-neutral-200 px-1 py-0.5 text-[9px] text-neutral-500">{disp.cargo}</span>}
          </div>
          <p className="mt-1 text-neutral-700">{disp.texto}</p>
          {disp.vigencia_fim && (
            <p className="mt-0.5 text-[10px] text-neutral-400">
              Vigência até {new Date(disp.vigencia_fim + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
          )}
          {disp.alterado_por && (
            <p className="mt-0.5 text-[10px] text-neutral-400">Alterado por: {disp.alterado_por}</p>
          )}
        </div>
        {podeEditar && (
          <button
            onClick={async () => {
              await fetch(`/api/base-normativa/dispositivos?id=${disp.id}`, { method: "DELETE" });
              onRecarregar();
            }}
            className="shrink-0 rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500"
            title="Excluir dispositivo"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function NovoDispositivoBtn({
  fonteId,
  onSalvar,
}: {
  fonteId: string;
  onSalvar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [campos, setCampos] = useState({ artigo: "", paragrafo: "", inciso: "", alinea: "", texto: "", tema: "", cargo: "", etapa: "" });
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!campos.texto.trim()) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/base-normativa/dispositivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fonte_id: fonteId, ...campos }),
      });
      if (res.ok) { setAberto(false); setCampos({ artigo: "", paragrafo: "", inciso: "", alinea: "", texto: "", tema: "", cargo: "", etapa: "" }); onSalvar(); }
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700">
        <Plus size={10} /> Adicionar
      </button>
    );
  }

  return (
    <div className="col-span-full mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <div className="grid grid-cols-4 gap-2">
        <input value={campos.artigo} onChange={(e) => setCampos({ ...campos, artigo: e.target.value })} placeholder="Artigo" className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs" />
        <input value={campos.paragrafo} onChange={(e) => setCampos({ ...campos, paragrafo: e.target.value })} placeholder="Parágrafo" className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs" />
        <input value={campos.inciso} onChange={(e) => setCampos({ ...campos, inciso: e.target.value })} placeholder="Inciso" className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs" />
        <input value={campos.alinea} onChange={(e) => setCampos({ ...campos, alinea: e.target.value })} placeholder="Alínea" className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs" />
      </div>
      <textarea value={campos.texto} onChange={(e) => setCampos({ ...campos, texto: e.target.value })} placeholder="Texto do dispositivo *" rows={3} className="mt-2 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs" />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <input value={campos.tema} onChange={(e) => setCampos({ ...campos, tema: e.target.value })} placeholder="Tema" className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs" />
        <input value={campos.cargo} onChange={(e) => setCampos({ ...campos, cargo: e.target.value })} placeholder="Cargo" className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs" />
        <input value={campos.etapa} onChange={(e) => setCampos({ ...campos, etapa: e.target.value })} placeholder="Etapa" className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs" />
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={salvar} disabled={salvando || !campos.texto.trim()} className="flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          <Save size={10} /> Salvar
        </button>
        <button onClick={() => setAberto(false)} className="rounded bg-neutral-200 px-2.5 py-1 text-[10px] font-medium text-neutral-600">
          Cancelar
        </button>
      </div>
    </div>
  );
}
