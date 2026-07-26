"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Demanda = {
  id: string;
  regiao: string | null;
  cidades: string[] | null;
  tema: string | null;
  demanda: string;
  created_at: string;
};

type Tema = { id: string; nome: string };

function CidadesAutocomplete({
  cidades,
  onChange,
  cidadesConhecidas,
}: {
  cidades: string[];
  onChange: (v: string[]) => void;
  cidadesConhecidas: string[];
}) {
  const [input, setInput] = useState("");
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const filtradas = input.trim()
    ? cidadesConhecidas.filter(
        (c) => c.toLowerCase().includes(input.trim().toLowerCase()) && !cidades.includes(c)
      )
    : cidadesConhecidas.filter((c) => !cidades.includes(c));

  function adicionar(valor?: string) {
    const limpo = (valor ?? input).trim();
    if (!limpo || cidades.includes(limpo)) return;
    onChange([...cidades, limpo]);
    setInput("");
    setAberto(false);
    ref.current?.focus();
  }

  return (
    <div className="space-y-1">
      {cidades.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cidades.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
            >
              {c}
              <button
                type="button"
                onClick={() => onChange(cidades.filter((_, j) => j !== i))}
                className="text-indigo-400 hover:text-indigo-700"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          ref={ref}
          placeholder="Buscar ou adicionar cidade"
          value={input}
          onChange={(e) => { setInput(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
        />
        {aberto && filtradas.length > 0 && (
          <div className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-32 overflow-y-auto rounded border border-neutral-200 bg-white shadow-lg">
            {filtradas.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => adicionar(c)}
                className="block w-full px-2 py-1 text-left text-xs hover:bg-indigo-50 hover:text-indigo-700"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DemandaCard({
  d,
  cidadesConhecidas,
  temas,
  podeEditar,
  onSaved,
}: {
  d: Demanda;
  cidadesConhecidas: string[];
  temas: Tema[];
  podeEditar: boolean;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [editando, setEditando] = useState(false);
  const [regiao, setRegiao] = useState(d.regiao ?? "");
  const [cidades, setCidades] = useState<string[]>(d.cidades ?? []);
  const [temaSelected, setTemaSelected] = useState(
    temas.find((t) => t.nome === d.tema)?.id ?? ""
  );
  const [demanda, setDemanda] = useState(d.demanda);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  function cancelar() {
    setEditando(false);
    setRegiao(d.regiao ?? "");
    setCidades(d.cidades ?? []);
    setTemaSelected(temas.find((t) => t.nome === d.tema)?.id ?? "");
    setDemanda(d.demanda);
    setErro(null);
    setConfirmandoExclusao(false);
  }

  async function salvar() {
    if (!demanda.trim()) { setErro("Demanda é obrigatória"); return; }
    setSalvando(true);
    setErro(null);
    const temaSelecionado = temas.find((t) => t.id === temaSelected);
    const { error } = await supabase
      .from("demandas_observadas")
      .update({
        regiao: regiao.trim() || null,
        cidades: cidades.length > 0 ? cidades : [],
        tema: temaSelecionado?.nome ?? null,
        demanda: demanda.trim(),
      })
      .eq("id", d.id);
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setEditando(false);
    onSaved();
  }

  async function excluir() {
    setSalvando(true);
    const { error } = await supabase
      .from("demandas_observadas")
      .delete()
      .eq("id", d.id);
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onSaved();
  }

  if (!editando) {
    return (
      <li className="rounded border border-neutral-200 p-3 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {d.tema && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">{d.tema}</span>
          )}
          {d.regiao && <span>{d.regiao}</span>}
          {(d.cidades ?? []).length > 0 && (
            <span>{(d.cidades as string[]).join(", ")}</span>
          )}
          {podeEditar && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="ml-auto text-indigo-600 hover:text-indigo-800 text-xs font-medium"
            >
              Editar
            </button>
          )}
        </div>
        <p className="text-sm">{d.demanda}</p>
      </li>
    );
  }

  return (
    <li className="rounded border-2 border-indigo-200 bg-indigo-50/30 p-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Região</label>
          <input
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Cidades</label>
          <CidadesAutocomplete
            cidades={cidades}
            onChange={setCidades}
            cidadesConhecidas={cidadesConhecidas}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Tema</label>
        <select
          value={temaSelected}
          onChange={(e) => setTemaSelected(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
        >
          <option value="">Sem tema</option>
          {temas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Demanda</label>
        <textarea
          rows={3}
          value={demanda}
          onChange={(e) => setDemanda(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
        />
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={cancelar}
          className="rounded bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
        >
          Cancelar
        </button>
        <div className="ml-auto">
          {!confirmandoExclusao ? (
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(true)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Excluir
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs">
              <span className="text-red-600">Tem certeza?</span>
              <button
                type="button"
                onClick={excluir}
                disabled={salvando}
                className="font-medium text-red-600 hover:text-red-800"
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(false)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                Não
              </button>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function DemandasLista({
  demandas,
  cidadesConhecidas,
  temas,
  podeEditar,
}: {
  demandas: Demanda[];
  cidadesConhecidas: string[];
  temas: Tema[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("");

  const filtroLower = filtro.trim().toLowerCase();
  const demandasFiltradas = filtroLower
    ? demandas.filter((d) => {
        const cidadesArr = d.cidades ?? [];
        return cidadesArr.some((c) => c.toLowerCase().includes(filtroLower));
      })
    : demandas;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Registradas
      </h2>

      <div className="relative">
        <input
          placeholder="Filtrar por cidade..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
          list="cidades-datalist"
        />
        <datalist id="cidades-datalist">
          {cidadesConhecidas.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {filtroLower && (
          <button
            type="button"
            onClick={() => setFiltro("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-sm"
          >
            limpar
          </button>
        )}
      </div>

      {filtroLower && (
        <p className="text-xs text-neutral-400">
          {demandasFiltradas.length} demanda(s) em cidades com &quot;{filtro.trim()}&quot;
        </p>
      )}

      {demandasFiltradas.length === 0 && (
        <p className="text-sm text-neutral-400">
          {filtroLower
            ? "Nenhuma demanda encontrada para essa cidade."
            : "Nenhuma demanda registrada ainda."}
        </p>
      )}

      <ul className="space-y-2">
        {demandasFiltradas.map((d) => (
          <DemandaCard
            key={d.id}
            d={d}
            cidadesConhecidas={cidadesConhecidas}
            temas={temas}
            podeEditar={podeEditar}
            onSaved={() => router.refresh()}
          />
        ))}
      </ul>
    </section>
  );
}
