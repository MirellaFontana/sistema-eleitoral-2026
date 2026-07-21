"use client";

import { useState } from "react";
import { BuscaMencoesPanel } from "./BuscaMencoesPanel";
import { MonitoramentoForm } from "./MonitoramentoForm";
import { TermosMonitoramento, type TermoView } from "./TermosMonitoramento";

export function MonitoramentoWorkspace({
  campanhaId,
  termos,
}: {
  campanhaId: string;
  termos: TermoView[];
}) {
  const [prefill, setPrefill] = useState<{ url: string; descricao: string } | null>(null);

  return (
    <div className="space-y-4">
      <TermosMonitoramento campanhaId={campanhaId} termos={termos} />
      <BuscaMencoesPanel onEscolher={setPrefill} />
      <MonitoramentoForm
        campanhaId={campanhaId}
        prefillUrl={prefill?.url}
        prefillDescricao={prefill?.descricao}
      />
    </div>
  );
}
