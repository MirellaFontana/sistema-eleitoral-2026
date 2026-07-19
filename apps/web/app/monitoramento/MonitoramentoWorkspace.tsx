"use client";

import { useState } from "react";
import { BuscaMencoesPanel } from "./BuscaMencoesPanel";
import { MonitoramentoForm } from "./MonitoramentoForm";

export function MonitoramentoWorkspace({ campanhaId }: { campanhaId: string }) {
  const [prefill, setPrefill] = useState<{ url: string; descricao: string } | null>(null);

  return (
    <div className="space-y-4">
      <BuscaMencoesPanel onEscolher={setPrefill} />
      <MonitoramentoForm
        campanhaId={campanhaId}
        prefillUrl={prefill?.url}
        prefillDescricao={prefill?.descricao}
      />
    </div>
  );
}
