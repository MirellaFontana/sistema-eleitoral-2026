"use client";

import { useRouter } from "next/navigation";

type Campanha = {
  id: string;
  nome_candidato: string;
  cargo: string | null;
  uf: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ativa: { label: "Ativa", cls: "bg-green-100 text-green-700" },
  suspensa: { label: "Suspensa", cls: "bg-yellow-100 text-yellow-700" },
  encerrada: { label: "Encerrada", cls: "bg-neutral-100 text-neutral-500" },
};

export function DevCampanhasList({
  campanhas,
  campanhaAtualId,
}: {
  campanhas: Campanha[];
  campanhaAtualId: string | null;
}) {
  const router = useRouter();

  function acessar(id: string) {
    router.push(`/dev/campanhas/${id}`);
  }

  if (campanhas.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        Nenhuma campanha cadastrada no sistema.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {campanhas.map((c) => {
        const s = STATUS_LABEL[c.status] ?? { label: c.status, cls: "bg-neutral-100" };
        const isAtual = c.id === campanhaAtualId;

        return (
          <li
            key={c.id}
            className={`rounded border p-3 space-y-1 cursor-pointer transition hover:border-indigo-300 hover:bg-indigo-50/30 ${
              isAtual ? "border-indigo-300 bg-indigo-50/20" : "border-neutral-200"
            }`}
            onClick={() => acessar(c.id)}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{c.nome_candidato}</p>
              <div className="flex items-center gap-2">
                {isAtual && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    Atual
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                  {s.label}
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-400">
              {[c.cargo, c.uf].filter(Boolean).join(" — ") || "Cargo não definido"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
