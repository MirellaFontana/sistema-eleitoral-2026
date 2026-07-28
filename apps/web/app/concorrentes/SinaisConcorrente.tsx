"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Plus, X } from "lucide-react";

type Sinal = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  fonte: string | null;
  url: string | null;
  data_ocorrencia: string | null;
  impacto: string | null;
  resposta_sugerida: string | null;
  created_at: string;
  usuarios_internos: { nome: string } | null;
};

const TIPO_LABEL: Record<string, string> = {
  declaracao: "Declaração",
  evento: "Evento",
  alianca: "Aliança",
  propaganda: "Propaganda",
  pesquisa: "Pesquisa",
  midia: "Mídia",
  juridico: "Jurídico",
  outro: "Outro",
};

export function SinaisConcorrente({
  concorrenteId,
  podeRegistrar,
}: {
  concorrenteId: string;
  podeRegistrar: boolean;
}) {
  const [sinais, setSinais] = useState<Sinal[]>([]);
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/sinais-concorrentes?concorrente_id=${concorrenteId}`);
    const json = await res.json();
    setSinais(json.sinais ?? []);
    setLoading(false);
  }, [concorrenteId]);

  useEffect(() => {
    if (aberto && sinais.length === 0) carregar();
  }, [aberto, carregar, sinais.length]);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/sinais-concorrentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        concorrente_id: concorrenteId,
        tipo: fd.get("tipo") || "outro",
        titulo: fd.get("titulo"),
        descricao: fd.get("descricao") || null,
        fonte: fd.get("fonte") || null,
        url: fd.get("url") || null,
        data_ocorrencia: fd.get("data_ocorrencia") || null,
        impacto: fd.get("impacto") || null,
        resposta_sugerida: fd.get("resposta_sugerida") || null,
      }),
    });
    setFormAberto(false);
    carregar();
  }

  return (
    <div className="mt-2 border-t border-neutral-100 pt-2">
      <button
        onClick={() => setAberto(!aberto)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
      >
        <AlertTriangle size={12} />
        Sinais de inteligência
        {aberto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {aberto && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <p className="text-xs text-neutral-400">Carregando…</p>
          ) : sinais.length === 0 ? (
            <p className="text-xs text-neutral-400">Nenhum sinal registrado.</p>
          ) : (
            sinais.map((s) => (
              <div key={s.id} className="rounded border border-neutral-100 bg-neutral-50 p-2">
                <button
                  onClick={() => setExpandido(expandido === s.id ? null : s.id)}
                  className="flex w-full items-start gap-2 text-left"
                >
                  <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                    {TIPO_LABEL[s.tipo] ?? s.tipo}
                  </span>
                  <span className="flex-1 text-sm text-neutral-700">{s.titulo}</span>
                  <span className="shrink-0 text-[10px] text-neutral-400">
                    {s.data_ocorrencia ?? new Date(s.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </button>
                {expandido === s.id && (
                  <div className="mt-1.5 space-y-1 pl-1 text-xs text-neutral-600">
                    {s.descricao && <p>{s.descricao}</p>}
                    {s.fonte && <p><span className="font-medium text-neutral-500">Fonte:</span> {s.fonte}</p>}
                    {s.url && <p><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{s.url}</a></p>}
                    {s.impacto && <p><span className="font-medium text-neutral-500">Impacto:</span> {s.impacto}</p>}
                    {s.resposta_sugerida && (
                      <p className="rounded bg-green-50 p-1.5 text-green-800">
                        <span className="font-medium">Resposta sugerida:</span> {s.resposta_sugerida}
                      </p>
                    )}
                    <p className="text-neutral-400">{s.usuarios_internos?.nome}</p>
                  </div>
                )}
              </div>
            ))
          )}

          {podeRegistrar && !formAberto && (
            <button onClick={() => setFormAberto(true)} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
              <Plus size={12} /> Registrar sinal
            </button>
          )}

          {formAberto && (
            <form onSubmit={salvar} className="space-y-2 rounded border border-indigo-200 bg-indigo-50/50 p-2">
              <div className="grid grid-cols-2 gap-2">
                <select name="tipo" className="rounded border border-neutral-300 px-1.5 py-1 text-xs">
                  {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input name="data_ocorrencia" type="date" className="rounded border border-neutral-300 px-1.5 py-1 text-xs" />
              </div>
              <input name="titulo" required placeholder="Título do sinal *" className="block w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
              <textarea name="descricao" rows={2} placeholder="Descrição" className="block w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <input name="fonte" placeholder="Fonte" className="rounded border border-neutral-300 px-2 py-1 text-xs" />
                <input name="url" placeholder="URL" className="rounded border border-neutral-300 px-2 py-1 text-xs" />
              </div>
              <input name="impacto" placeholder="Impacto potencial" className="block w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
              <textarea name="resposta_sugerida" rows={2} placeholder="Resposta sugerida" className="block w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
              <div className="flex gap-2">
                <button type="submit" className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">Salvar</button>
                <button type="button" onClick={() => setFormAberto(false)} className="text-xs text-neutral-500 hover:underline">Cancelar</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
