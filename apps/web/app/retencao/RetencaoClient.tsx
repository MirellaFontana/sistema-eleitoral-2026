"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Shield, Trash2, Database } from "lucide-react";

type Config = {
  id: string;
  tabela: string;
  dias_retencao: number;
  acao: string;
  ativo: boolean;
  descricao: string | null;
  updated_at: string;
};

const ACAO_LABEL: Record<string, string> = {
  anonimizar: "Anonimizar",
  excluir: "Excluir",
  manter: "Manter (obrigatório)",
};

const ACAO_ICON: Record<string, typeof Shield> = {
  anonimizar: Shield,
  excluir: Trash2,
  manter: Database,
};

export function RetencaoClient() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/retencao");
    const json = await res.json();
    setConfigs(json.configs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function atualizar(id: string, campos: Partial<Config>) {
    await fetch("/api/retencao", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...campos }),
    });
    carregar();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">Retenção de dados</h1>
        <p className="text-sm text-neutral-500">
          Configure por quanto tempo cada tipo de dado é mantido e o que acontece após o prazo.
          Ações só são executadas quando ativadas.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-neutral-100" />)}
        </div>
      ) : configs.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma configuração encontrada.</p>
      ) : (
        <div className="space-y-3">
          {configs.map((c) => {
            const Icon = ACAO_ICON[c.acao] ?? Clock;
            return (
              <div key={c.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <Icon size={18} className="mt-0.5 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-neutral-900">{c.tabela}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.ativo ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    {c.descricao && <p className="mt-0.5 text-xs text-neutral-500">{c.descricao}</p>}

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <Clock size={12} />
                        <input
                          type="number"
                          min={1}
                          value={c.dias_retencao}
                          onChange={(e) => atualizar(c.id, { dias_retencao: parseInt(e.target.value) || 365 })}
                          className="w-16 rounded border border-neutral-300 px-1.5 py-0.5 text-xs"
                        />
                        dias
                      </label>

                      <select
                        value={c.acao}
                        onChange={(e) => atualizar(c.id, { acao: e.target.value })}
                        disabled={c.acao === "manter"}
                        className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs disabled:opacity-50"
                      >
                        <option value="anonimizar">Anonimizar</option>
                        <option value="excluir">Excluir</option>
                        <option value="manter">Manter</option>
                      </select>

                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={c.ativo}
                          onChange={(e) => atualizar(c.id, { ativo: e.target.checked })}
                          disabled={c.acao === "manter"}
                          className="rounded disabled:opacity-50"
                        />
                        Ativar
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong>Nota:</strong> As ações de retenção (anonimizar/excluir) precisam de um worker
        ou cron job configurado para serem executadas automaticamente. Consentimentos LGPD e
        auditoria são marcados como &ldquo;manter&rdquo; por exigência legal.
      </div>
    </div>
  );
}
