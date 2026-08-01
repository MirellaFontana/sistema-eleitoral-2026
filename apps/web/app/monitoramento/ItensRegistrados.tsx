"use client";

import { useState } from "react";
import { Lock, ExternalLink } from "lucide-react";
import { VerCapturaButton } from "./VerCapturaButton";

export type ItemMonitoramento = {
  id: string;
  url: string | null;
  descricao: string;
  categoria: string;
  gravidade: string | null;
  status: string;
  captura_path: string | null;
  hash_evidencia: string | null;
  created_at: string;
};

const CATEGORIA_META: Record<string, { label: string; cls: string }> = {
  ameaca_juridica: { label: "Ameaça jurídica", cls: "bg-red-100 text-red-700" },
  deepfake_suspeito: { label: "Deepfake suspeito", cls: "bg-red-100 text-red-700" },
  gestao_crise: { label: "Gestão de crise", cls: "bg-amber-100 text-amber-700" },
  mencao_negativa: { label: "Menção negativa", cls: "bg-rose-100 text-rose-700" },
  mencao_positiva: { label: "Menção positiva", cls: "bg-green-100 text-green-700" },
  mencao_neutra: { label: "Menção neutra", cls: "bg-neutral-100 text-neutral-600" },
  oportunidade_marketing: { label: "Oportunidade", cls: "bg-indigo-100 text-indigo-700" },
  outro: { label: "Outro", cls: "bg-neutral-100 text-neutral-600" },
};

const GRAVIDADE_META: Record<string, { label: string; cls: string }> = {
  alta: { label: "Alta", cls: "bg-red-600 text-white" },
  media: { label: "Média", cls: "bg-amber-500 text-white" },
  baixa: { label: "Baixa", cls: "bg-neutral-200 text-neutral-600" },
};

export function ItensRegistrados({ itens }: { itens: ItemMonitoramento[] }) {
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [soGraves, setSoGraves] = useState(false);

  const categoriasPresentes = Array.from(new Set(itens.map((i) => i.categoria)));

  const filtrados = itens.filter((i) => {
    if (filtroCategoria && i.categoria !== filtroCategoria) return false;
    if (soGraves && i.gravidade !== "alta") return false;
    return true;
  });

  if (itens.length === 0) {
    return <p className="text-sm text-neutral-400">Nenhum item registrado ainda.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFiltroCategoria("")}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            !filtroCategoria
              ? "bg-neutral-900 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          Tudo ({itens.length})
        </button>
        {categoriasPresentes.map((cat) => {
          const meta = CATEGORIA_META[cat] ?? { label: cat, cls: "bg-neutral-100 text-neutral-600" };
          const count = itens.filter((i) => i.categoria === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(filtroCategoria === cat ? "" : cat)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                filtroCategoria === cat ? "ring-2 ring-neutral-900 " + meta.cls : meta.cls + " opacity-80 hover:opacity-100"
              }`}
            >
              {meta.label} ({count})
            </button>
          );
        })}
        <button
          onClick={() => setSoGraves(!soGraves)}
          className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            soGraves ? "bg-red-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          Só gravidade alta
        </button>
      </div>

      {filtrados.length === 0 && (
        <p className="text-sm text-neutral-400">Nenhum item nesse filtro.</p>
      )}

      <ul className="space-y-2">
        {filtrados.map((item) => {
          const catMeta = CATEGORIA_META[item.categoria] ?? {
            label: item.categoria,
            cls: "bg-neutral-100 text-neutral-600",
          };
          const gravMeta = item.gravidade ? GRAVIDADE_META[item.gravidade] : null;
          return (
            <li
              key={item.id}
              className="rounded-lg border border-neutral-200 bg-white p-3 space-y-1.5 shadow-sm shadow-neutral-900/5"
            >
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium ${catMeta.cls}`}>
                  {catMeta.label}
                </span>
                {gravMeta && (
                  <span className={`rounded-full px-2 py-0.5 font-medium ${gravMeta.cls}`}>
                    {gravMeta.label}
                  </span>
                )}
                <span className="text-neutral-400">{item.status}</span>
                {item.hash_evidencia && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                    <Lock size={11} strokeWidth={2} aria-hidden="true" />
                    Evidência lacrada
                  </span>
                )}
                <span className="ml-auto text-neutral-400">
                  {new Date(item.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{item.descricao}</p>
              <div className="flex gap-3">
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    <ExternalLink size={11} />
                    Abrir link
                  </a>
                )}
                {item.captura_path && <VerCapturaButton path={item.captura_path} />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
