"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ExternalLink, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

function nomeFonte(url: string, fontes: { dominio: string; nome: string }[]): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    // Fonte cadastrada cujo domínio (pode incluir path, ex. g1.globo.com/parana) bate com a URL
    const fonte = fontes.find((f) => {
      const [fHost, ...fPath] = f.dominio.split("/");
      return host === fHost && (fPath.length === 0 || u.pathname.startsWith("/" + fPath.join("/")));
    });
    return fonte?.nome ?? host;
  } catch {
    return "Abrir link";
  }
}

export function ItensRegistrados({
  itens,
  fontes = [],
}: {
  itens: ItemMonitoramento[];
  fontes?: { dominio: string; nome: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [soGraves, setSoGraves] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const categoriasPresentes = Array.from(new Set(itens.map((i) => i.categoria)));

  const filtrados = itens.filter((i) => {
    if (filtroCategoria && i.categoria !== filtroCategoria) return false;
    if (soGraves && i.gravidade !== "alta") return false;
    return true;
  });

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === filtrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filtrados.map((i) => i.id)));
    }
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    if (!confirm(`Excluir ${selecionados.size} item(ns) do monitoramento?`)) return;
    const ids = Array.from(selecionados);
    await supabase.from("monitoramento_itens").delete().in("id", ids);
    setSelecionados(new Set());
    router.refresh();
  }

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

      {selecionados.size > 0 && (
        <div className="flex items-center gap-3 rounded border border-red-200 bg-red-50 px-3 py-2">
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 cursor-pointer">
            <input
              type="checkbox"
              checked={selecionados.size === filtrados.length}
              onChange={toggleTodos}
              className="accent-red-600"
            />
            {selecionados.size === filtrados.length ? "Desmarcar todos" : "Marcar todos"}
          </label>
          <span className="text-xs text-neutral-500">{selecionados.size} selecionado(s)</span>
          <button
            type="button"
            onClick={excluirSelecionados}
            className="ml-auto flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            <Trash2 size={12} />
            Excluir selecionados
          </button>
        </div>
      )}

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
          const marcado = selecionados.has(item.id);
          return (
            <li
              key={item.id}
              className={`rounded-lg border bg-white p-3 space-y-1.5 shadow-sm shadow-neutral-900/5 ${
                marcado ? "border-red-300 bg-red-50/30" : "border-neutral-200"
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => toggleSelecionado(item.id)}
                  className="accent-red-600 mr-1"
                />
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
              <div className="flex items-center gap-3">
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir a matéria"
                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    <ExternalLink size={11} />
                    {nomeFonte(item.url, fontes)}
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
