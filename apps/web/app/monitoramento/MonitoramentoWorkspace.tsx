"use client";

import { MonitoramentoForm } from "./MonitoramentoForm";
import { TermosMonitoramento, type TermoView } from "./TermosMonitoramento";

export function MonitoramentoWorkspace({
  campanhaId,
  termos,
}: {
  campanhaId: string;
  termos: TermoView[];
}) {
  return (
    <div className="space-y-4">
      <TermosMonitoramento campanhaId={campanhaId} termos={termos} />
      <MonitoramentoForm campanhaId={campanhaId} />
    </div>
  );
}
