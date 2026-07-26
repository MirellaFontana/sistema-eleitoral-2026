"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tema = { id: string; nome: string };

export function DemandaForm({
  campanhaId,
  temas: temasIniciais,
  cidadesConhecidas,
}: {
  campanhaId: string;
  temas: Tema[];
  cidadesConhecidas: string[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [regiao, setRegiao] = useState("");
  const [cidades, setCidades] = useState<string[]>([]);
  const [cidadeInput, setCidadeInput] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [temaId, setTemaId] = useState("");
  const [novoTema, setNovoTema] = useState("");
  const [criandoTema, setCriandoTema] = useState(false);
  const [temas, setTemas] = useState(temasIniciais);
  const [demanda, setDemanda] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const inputCidadeRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sugestoesFiltradas = cidadeInput.trim()
    ? cidadesConhecidas.filter(
        (c) =>
          c.toLowerCase().includes(cidadeInput.trim().toLowerCase()) &&
          !cidades.includes(c)
      )
    : cidadesConhecidas.filter((c) => !cidades.includes(c));

  function adicionarCidade(valor?: string) {
    const limpo = (valor ?? cidadeInput).trim();
    if (!limpo || cidades.includes(limpo)) return;
    setCidades([...cidades, limpo]);
    setCidadeInput("");
    setMostrarSugestoes(false);
    inputCidadeRef.current?.focus();
  }

  function removerCidade(idx: number) {
    setCidades(cidades.filter((_, i) => i !== idx));
  }

  async function criarTema() {
    const nome = novoTema.trim();
    if (!nome) return;
    setCriandoTema(true);
    const { data, error } = await supabase
      .from("temas_campanha")
      .insert({ campanha_id: campanhaId, nome, ordem: temas.length + 1 })
      .select("id, nome")
      .single();
    setCriandoTema(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setTemas([...temas, data]);
    setTemaId(data.id);
    setNovoTema("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const temaSelecionado = temas.find((t) => t.id === temaId);

    const { error } = await supabase.from("demandas_observadas").insert({
      campanha_id: campanhaId,
      regiao: regiao.trim() || null,
      cidades: cidades.length > 0 ? cidades : [],
      tema: temaSelecionado?.nome ?? null,
      demanda,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso("Demanda registrada.");
    setTimeout(() => setSucesso(null), 3000);
    setRegiao("");
    setCidades([]);
    setCidadeInput("");
    setTemaId("");
    setDemanda("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Região</label>
          <input
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Cidades</label>
          {cidades.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {cidades.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removerCidade(i)}
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
              ref={inputCidadeRef}
              placeholder="Digite para buscar ou adicionar"
              value={cidadeInput}
              onChange={(e) => {
                setCidadeInput(e.target.value);
                setMostrarSugestoes(true);
              }}
              onFocus={() => setMostrarSugestoes(true)}
              onBlur={() => {
                setTimeout(() => setMostrarSugestoes(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarCidade();
                }
              }}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
            {mostrarSugestoes && sugestoesFiltradas.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-40 overflow-y-auto rounded border border-neutral-200 bg-white shadow-lg"
              >
                {sugestoesFiltradas.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => adicionarCidade(c)}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          {cidadeInput.trim() &&
            !cidadesConhecidas.some(
              (c) => c.toLowerCase() === cidadeInput.trim().toLowerCase()
            ) && (
              <p className="text-xs text-neutral-400 mt-0.5">
                Enter para adicionar &quot;{cidadeInput.trim()}&quot;
              </p>
            )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Tema</label>
        <select
          value={temaId}
          onChange={(e) => setTemaId(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">Selecione um tema</option>
          {temas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <div className="flex gap-1 mt-1">
          <input
            placeholder="Ou crie um novo tema"
            value={novoTema}
            onChange={(e) => setNovoTema(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                criarTema();
              }
            }}
            className="rounded border border-neutral-300 px-2 py-1 text-xs w-48"
          />
          <button
            type="button"
            onClick={criarTema}
            disabled={criandoTema || !novoTema.trim()}
            className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-200 disabled:opacity-50"
          >
            {criandoTema ? "..." : "+ Criar"}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Demanda</label>
        <textarea
          required
          rows={3}
          value={demanda}
          onChange={(e) => setDemanda(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Salvando…" : "Registrar demanda"}
      </button>
    </form>
  );
}
