"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, ChevronUp, Plus, X, Search } from "lucide-react";

type Registro = {
  id: string;
  publico: string;
  demandas_reclamacoes: string | null;
  propostas: string | null;
};

function CardPublico({
  r,
  podeEditar,
  onSaved,
}: {
  r: Registro;
  podeEditar: boolean;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [aberto, setAberto] = useState(
    !!(r.demandas_reclamacoes?.trim() || r.propostas?.trim())
  );
  const [demandas, setDemandas] = useState(r.demandas_reclamacoes ?? "");
  const [propostas, setPropostas] = useState(r.propostas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function salvar() {
    setSalvando(true);
    await supabase
      .from("propostas_publicos")
      .update({
        demandas_reclamacoes: demandas.trim() || null,
        propostas: propostas.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    setSalvando(false);
    setDirty(false);
    onSaved();
  }

  const temConteudo = !!(r.demandas_reclamacoes?.trim() || r.propostas?.trim());

  return (
    <li className="rounded border border-neutral-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{r.publico}</span>
          {temConteudo && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
              preenchido
            </span>
          )}
        </div>
        {aberto ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
      </button>

      {aberto && (
        <div className="border-t border-neutral-100 px-4 py-3 space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">
              Demandas e reclamações
            </label>
            {podeEditar ? (
              <textarea
                rows={3}
                value={demandas}
                onChange={(e) => { setDemandas(e.target.value); setDirty(true); }}
                placeholder="O que esse público demanda, reclama ou espera?"
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            ) : (
              <p className="text-sm text-neutral-600 whitespace-pre-wrap">
                {r.demandas_reclamacoes || <span className="text-neutral-400 italic">Não preenchido</span>}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">
              Propostas
            </label>
            {podeEditar ? (
              <textarea
                rows={3}
                value={propostas}
                onChange={(e) => { setPropostas(e.target.value); setDirty(true); }}
                placeholder="Propostas da campanha para atender esse público"
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            ) : (
              <p className="text-sm text-neutral-600 whitespace-pre-wrap">
                {r.propostas || <span className="text-neutral-400 italic">Não preenchido</span>}
              </p>
            )}
          </div>

          {podeEditar && dirty && (
            <button
              onClick={salvar}
              disabled={salvando}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function PropostasPublicosClient({
  registros: initial,
  podeEditar,
  campanhaId,
}: {
  registros: Registro[];
  podeEditar: boolean;
  campanhaId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [registros, setRegistros] = useState(initial);
  const [busca, setBusca] = useState("");
  const [novoPublico, setNovoPublico] = useState("");
  const [adicionando, setAdicionando] = useState(false);

  async function addPublico() {
    const nome = novoPublico.trim();
    if (!nome) return;
    if (registros.some((r) => r.publico.toLowerCase() === nome.toLowerCase())) return;
    setAdicionando(true);
    const { data } = await supabase
      .from("propostas_publicos")
      .insert({ campanha_id: campanhaId, publico: nome })
      .select("id, publico, demandas_reclamacoes, propostas")
      .single();
    setAdicionando(false);
    if (data) {
      setRegistros([...registros, data]);
      setNovoPublico("");
    }
  }

  async function removerPublico(id: string) {
    await supabase.from("propostas_publicos").delete().eq("id", id);
    setRegistros(registros.filter((r) => r.id !== id));
  }

  const buscaLower = busca.trim().toLowerCase();
  const filtrados = buscaLower
    ? registros.filter((r) => r.publico.toLowerCase().includes(buscaLower))
    : registros;

  const preenchidos = registros.filter(
    (r) => r.demandas_reclamacoes?.trim() || r.propostas?.trim()
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{preenchidos} de {registros.length} públicos preenchidos</span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            placeholder="Buscar público..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded border border-neutral-300 pl-8 pr-3 py-1.5 text-sm"
          />
        </div>
        {podeEditar && (
          <div className="flex gap-1">
            <input
              placeholder="Novo público"
              value={novoPublico}
              onChange={(e) => setNovoPublico(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPublico(); } }}
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm w-44"
            />
            <button
              onClick={addPublico}
              disabled={adicionando || !novoPublico.trim()}
              className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200 disabled:opacity-50"
            >
              <Plus size={12} /> Adicionar
            </button>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {filtrados.map((r) => (
          <div key={r.id} className="group relative">
            <CardPublico r={r} podeEditar={podeEditar} onSaved={() => router.refresh()} />
            {podeEditar && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remover "${r.publico}"?`)) removerPublico(r.id);
                }}
                className="absolute right-10 top-3 opacity-0 group-hover:opacity-100 rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                title="Remover público"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </ul>

      {filtrados.length === 0 && (
        <p className="text-sm text-neutral-400">
          {buscaLower ? "Nenhum público encontrado." : "Nenhum público cadastrado."}
        </p>
      )}
    </div>
  );
}
