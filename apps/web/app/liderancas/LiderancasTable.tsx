"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { labelTerritorio } from "@/lib/territorio";

type Territorio = { id: string; nome_bairro: string | null; cidade: string | null };

type Linha = {
  id: string;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  bairro: string | null;
  territorioId: string | null;
  status: string;
  cadastros: number;
  metaAlvo: number | null;
  progressoPct: number | null;
};

export function LiderancasTable({
  linhas,
  territorios,
  podeGerenciar,
}: {
  linhas: Linha[];
  territorios: Territorio[];
  podeGerenciar: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busca, setBusca] = useState("");
  const [alterando, setAlterando] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const filtradas = linhas.filter((l) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return [l.nome, l.cidade, l.bairro, l.telefone].some((v) => v?.toLowerCase().includes(q));
  });

  async function toggleStatus(l: Linha) {
    setAlterando(l.id);
    await supabase
      .from("liderancas")
      .update({ status: l.status === "ativa" ? "inativa" : "ativa" })
      .eq("id", l.id);
    setAlterando(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <input
        placeholder="Buscar liderança…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="w-full max-w-xs rounded border border-neutral-300 px-2 py-1.5 text-sm"
      />

      {filtradas.length === 0 && <p className="text-sm text-neutral-400">Nenhuma liderança encontrada.</p>}

      {filtradas.length > 0 && (
        <ul className="space-y-2">
          {filtradas.map((l) =>
            editandoId === l.id ? (
              <LiderancaEditRow
                key={l.id}
                linha={l}
                territorios={territorios}
                onCancelar={() => setEditandoId(null)}
                onSalvo={() => {
                  setEditandoId(null);
                  router.refresh();
                }}
              />
            ) : (
              <li key={l.id} className="rounded border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{l.nome}</p>
                    <p className="text-xs text-neutral-500">
                      {l.telefone ?? "—"} · {labelTerritorio(l.bairro, l.cidade)} · {l.cadastros} cadastros
                      {l.metaAlvo !== null ? ` · meta ${l.metaAlvo}` : ""}
                      {l.progressoPct !== null ? ` (${l.progressoPct}%)` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {podeGerenciar && (
                      <button
                        onClick={() => setEditandoId(l.id)}
                        className="flex items-center gap-1 rounded border border-neutral-300 px-2.5 py-0.5 text-xs font-medium hover:bg-neutral-50"
                      >
                        <Pencil size={12} strokeWidth={2} aria-hidden="true" />
                        Editar
                      </button>
                    )}
                    {podeGerenciar ? (
                      <button
                        onClick={() => toggleStatus(l)}
                        disabled={alterando === l.id}
                        title="Clique para alternar"
                        className={
                          l.status === "ativa"
                            ? "rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white disabled:opacity-50"
                            : "rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500 disabled:opacity-50"
                        }
                      >
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle opacity-70" />
                        {l.status === "ativa" ? "Ativa" : "Inativa"}
                      </button>
                    ) : (
                      <span
                        className={
                          l.status === "ativa"
                            ? "rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white"
                            : "rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500"
                        }
                      >
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle opacity-70" />
                        {l.status === "ativa" ? "Ativa" : "Inativa"}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

function LiderancaEditRow({
  linha,
  territorios,
  onCancelar,
  onSalvo,
}: {
  linha: Linha;
  territorios: Territorio[];
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const supabase = createClient();

  const [nome, setNome] = useState(linha.nome);
  const [telefone, setTelefone] = useState(linha.telefone ?? "");
  const [cidade, setCidade] = useState(linha.cidade ?? "");
  const [bairro, setBairro] = useState(linha.bairro ?? "");
  const [territorioId, setTerritorioId] = useState(linha.territorioId ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    const { error } = await supabase
      .from("liderancas")
      .update({
        nome: nome.trim(),
        telefone: telefone.trim(),
        cidade: cidade.trim() || null,
        bairro: bairro.trim() || null,
        territorio_id: territorioId || null,
      })
      .eq("id", linha.id);

    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    onSalvo();
  }

  return (
    <li className="rounded border border-neutral-300 bg-neutral-50 p-3">
      <form onSubmit={handleSalvar} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Nome</label>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Telefone</label>
            <input
              required
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Cidade</label>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Bairro</label>
            <input
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Território (mapa)</label>
            <select
              value={territorioId}
              onChange={(e) => setTerritorioId(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">nenhum</option>
              {territorios.map((t) => (
                <option key={t.id} value={t.id}>
                  {labelTerritorio(t.nome_bairro, t.cidade)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Check size={14} strokeWidth={2} aria-hidden="true" />
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="flex items-center gap-1.5 rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
            Cancelar
          </button>
        </div>
      </form>
    </li>
  );
}
