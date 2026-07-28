"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, Check, X, ChevronDown, ChevronUp, AlertTriangle, Clock, Ban } from "lucide-react";

type Lote = {
  id: string;
  descricao: string;
  origem: string;
  tipo: string;
  total_registros: number;
  aprovados: number;
  rejeitados: number;
  pendentes: number;
  created_at: string;
  usuarios_internos: { nome: string } | null;
};

type Registro = {
  id: string;
  dados: Record<string, unknown>;
  tipo: string;
  status: "pendente" | "aprovado" | "rejeitado" | "expirado";
  motivo_rejeicao: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700",
  aprovado: "bg-green-100 text-green-700",
  rejeitado: "bg-red-100 text-red-700",
  expirado: "bg-neutral-100 text-neutral-500",
};

export function QuarentenaClient({ podeRevisar }: { podeRevisar: boolean }) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loteAberto, setLoteAberto] = useState<string | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loadingReg, setLoadingReg] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/quarentena");
    const json = await res.json();
    setLotes(json.lotes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function abrirLote(id: string) {
    if (loteAberto === id) { setLoteAberto(null); return; }
    setLoteAberto(id);
    setLoadingReg(true);
    const res = await fetch(`/api/quarentena?lote_id=${id}`);
    const json = await res.json();
    setRegistros(json.registros ?? []);
    setLoadingReg(false);
  }

  async function revisar(regId: string, status: "aprovado" | "rejeitado", motivo?: string) {
    await fetch("/api/quarentena", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: regId, status, motivo_rejeicao: motivo }),
    });
    if (loteAberto) {
      const res = await fetch(`/api/quarentena?lote_id=${loteAberto}`);
      const json = await res.json();
      setRegistros(json.registros ?? []);
    }
    carregar();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">Quarentena de dados</h1>
        <p className="text-sm text-neutral-500">Revisão de registros importados antes da inclusão no sistema</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-neutral-100" />)}
        </div>
      ) : lotes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">
          <Package size={32} className="mx-auto mb-2 text-neutral-300" />
          Nenhum lote de importação registrado.
        </div>
      ) : (
        <div className="space-y-3">
          {lotes.map((lote) => (
            <div key={lote.id} className="rounded-lg border border-neutral-200 bg-white">
              <button onClick={() => abrirLote(lote.id)} className="flex w-full items-center gap-3 p-3 text-left">
                <Package size={18} className="shrink-0 text-neutral-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900">{lote.descricao}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                    <span>{lote.origem}</span>
                    <span>{new Date(lote.created_at).toLocaleDateString("pt-BR")}</span>
                    <span>{lote.usuarios_internos?.nome}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {lote.pendentes > 0 && <span className="flex items-center gap-0.5 text-amber-600"><Clock size={12} />{lote.pendentes}</span>}
                  {lote.aprovados > 0 && <span className="flex items-center gap-0.5 text-green-600"><Check size={12} />{lote.aprovados}</span>}
                  {lote.rejeitados > 0 && <span className="flex items-center gap-0.5 text-red-600"><Ban size={12} />{lote.rejeitados}</span>}
                  <span className="text-neutral-400">/ {lote.total_registros}</span>
                </div>
                {loteAberto === lote.id ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
              </button>

              {loteAberto === lote.id && (
                <div className="border-t border-neutral-100 px-3 pb-3">
                  {loadingReg ? (
                    <div className="py-4 text-center text-sm text-neutral-400">Carregando…</div>
                  ) : registros.length === 0 ? (
                    <div className="py-4 text-center text-sm text-neutral-400">Nenhum registro neste lote.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {registros.map((reg) => (
                        <RegistroRow key={reg.id} reg={reg} podeRevisar={podeRevisar} onRevisar={revisar} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RegistroRow({
  reg,
  podeRevisar,
  onRevisar,
}: {
  reg: Registro;
  podeRevisar: boolean;
  onRevisar: (id: string, status: "aprovado" | "rejeitado", motivo?: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);

  const resumo = Object.entries(reg.dados)
    .filter(([k]) => ["nome", "email", "telefone", "cpf"].includes(k))
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ") || JSON.stringify(reg.dados).slice(0, 80);

  return (
    <div className="rounded border border-neutral-100 bg-neutral-50 p-2">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[reg.status]}`}>
          {reg.status}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-neutral-700">{resumo}</p>
          {reg.motivo_rejeicao && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-red-500">
              <AlertTriangle size={11} /> {reg.motivo_rejeicao}
            </p>
          )}
        </div>
        <button onClick={() => setExpandido(!expandido)} className="text-neutral-400 hover:text-neutral-600">
          {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expandido && (
        <div className="mt-2">
          <pre className="max-h-40 overflow-auto rounded bg-white p-2 text-xs text-neutral-600">
            {JSON.stringify(reg.dados, null, 2)}
          </pre>

          {podeRevisar && reg.status === "pendente" && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => onRevisar(reg.id, "aprovado")}
                className="flex items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
              >
                <Check size={12} /> Aprovar
              </button>
              <button
                onClick={() => {
                  const motivo = prompt("Motivo da rejeição:");
                  if (motivo) onRevisar(reg.id, "rejeitado", motivo);
                }}
                className="flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
              >
                <X size={12} /> Rejeitar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
