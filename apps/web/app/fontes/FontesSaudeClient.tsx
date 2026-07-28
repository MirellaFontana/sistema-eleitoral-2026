"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle, XCircle, Globe } from "lucide-react";

type Fonte = {
  id: string;
  nome: string;
  dominio: string;
  tier: string;
  ativo: boolean;
  ultimo_acesso_em: string | null;
  ultimo_status: number | null;
  falhas_consecutivas: number;
  total_acessos: number;
  observacoes: string | null;
  saude: "ok" | "alerta" | "falha" | "inativa";
  horas_desde_acesso: number | null;
};

const SAUDE_CONFIG: Record<string, { icon: typeof CheckCircle; badge: string; label: string }> = {
  ok: { icon: CheckCircle, badge: "bg-green-100 text-green-700", label: "OK" },
  alerta: { icon: AlertTriangle, badge: "bg-amber-100 text-amber-700", label: "Alerta" },
  falha: { icon: XCircle, badge: "bg-red-100 text-red-700", label: "Falha" },
  inativa: { icon: Globe, badge: "bg-neutral-100 text-neutral-500", label: "Inativa" },
};

const TIER_LABEL: Record<string, string> = {
  tier1_megafone: "Tier 1 — Megafone",
  tier1_politica: "Tier 1 — Política",
  tier1_cbn: "Tier 1 — CBN",
  tier2_regional: "Tier 2 — Regional",
};

export function FontesSaudeClient() {
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/fontes/saude");
    const json = await res.json();
    setFontes(json.fontes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const comProblema = fontes.filter((f) => f.saude === "falha" || f.saude === "alerta");
  const saudaveis = fontes.filter((f) => f.saude === "ok");
  const inativas = fontes.filter((f) => f.saude === "inativa");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-neutral-900">Saúde das fontes</h1>
        <p className="text-sm text-neutral-500">
          Status de conectividade e disponibilidade das fontes de monitoramento.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-100" />)}
        </div>
      ) : fontes.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma fonte de monitoramento cadastrada.</p>
      ) : (
        <>
          {/* Summary */}
          <div className="mb-5 flex gap-3">
            <div className="flex-1 rounded-lg border border-green-200 bg-green-50 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{saudaveis.length}</p>
              <p className="text-xs text-green-600">OK</p>
            </div>
            <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{comProblema.length}</p>
              <p className="text-xs text-amber-600">Com problema</p>
            </div>
            <div className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-center">
              <p className="text-2xl font-bold text-neutral-500">{inativas.length}</p>
              <p className="text-xs text-neutral-400">Inativas</p>
            </div>
          </div>

          {/* Problem sources first */}
          {comProblema.length > 0 && (
            <div className="mb-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-600">Fontes com problema</h2>
              <div className="space-y-2">
                {comProblema.map((f) => <FonteCard key={f.id} fonte={f} />)}
              </div>
            </div>
          )}

          {saudaveis.length > 0 && (
            <div className="mb-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Fontes saudáveis</h2>
              <div className="space-y-2">
                {saudaveis.map((f) => <FonteCard key={f.id} fonte={f} />)}
              </div>
            </div>
          )}

          {inativas.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Fontes inativas</h2>
              <div className="space-y-2">
                {inativas.map((f) => <FonteCard key={f.id} fonte={f} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FonteCard({ fonte: f }: { fonte: Fonte }) {
  const cfg = SAUDE_CONFIG[f.saude] ?? SAUDE_CONFIG.ok;
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <Icon size={16} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">{f.nome}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
        </div>
        <p className="text-xs text-neutral-400">
          {f.dominio} · {TIER_LABEL[f.tier] ?? f.tier}
          {f.horas_desde_acesso !== null && ` · Último acesso ${f.horas_desde_acesso}h atrás`}
          {f.falhas_consecutivas > 0 && ` · ${f.falhas_consecutivas} falhas`}
          {f.total_acessos > 0 && ` · ${f.total_acessos} acessos`}
        </p>
      </div>
      {f.ultimo_status && (
        <span className={`shrink-0 text-xs font-mono ${f.ultimo_status >= 400 ? "text-red-500" : "text-neutral-400"}`}>
          {f.ultimo_status}
        </span>
      )}
    </div>
  );
}
