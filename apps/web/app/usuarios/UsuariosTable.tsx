"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// "Embaixador" saiu das opções de convite (ref. specs.md [2026-07-15]) mas segue no banco como
// legado — se alguém antigo ainda tiver esse papel, a edição precisa continuar reconhecendo.
const PAPEIS = [
  { value: "embaixador", label: "Embaixador (legado)" },
  { value: "advogado_responsavel", label: "Advogado responsável" },
  { value: "assistente_juridico", label: "Assistente jurídico" },
  { value: "coord_marketing", label: "Coord. de marketing" },
  { value: "redator_marketing", label: "Redator de marketing" },
  { value: "coord_campanha", label: "Coord. de campanha" },
  { value: "candidato", label: "Candidato" },
  { value: "apoio_marketing", label: "Apoio de marketing" },
  { value: "apoio_campanha", label: "Apoio de campanha" },
  { value: "apoio_coordenacao", label: "Apoio de coordenação" },
];

const PAPEL_LABEL: Record<string, string> = Object.fromEntries(PAPEIS.map((p) => [p.value, p.label]));
const MFA_OBRIGATORIO = new Set(["coord_campanha", "candidato"]);
const STATUS_LABEL: Record<string, string> = { ativo: "Ativo", revogado: "Revogado", expirado: "Expirado" };

type Territorio = { id: string; nome_bairro: string | null };

type Linha = {
  id: string;
  nome: string;
  papel: string;
  status: string;
  expiraEm: string | null;
  territorioId: string | null;
  territorioNome: string | null;
};

function formatarDataUTC(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function UsuariosTable({
  linhas,
  territorios,
  podeGerenciar,
  meuId,
}: {
  linhas: Linha[];
  territorios: Territorio[];
  podeGerenciar: boolean;
  meuId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);

  async function alternarAcesso(l: Linha) {
    const revogando = l.status === "ativo";
    if (revogando && !window.confirm(`Revogar o acesso de "${l.nome}"? A pessoa perde o acesso ao sistema imediatamente.`)) {
      return;
    }
    setAlterandoId(l.id);
    await supabase
      .from("usuarios_internos")
      .update({ status: revogando ? "revogado" : "ativo" })
      .eq("id", l.id);
    setAlterandoId(null);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {linhas.length === 0 && <p className="text-sm text-neutral-400">Nenhum usuário ainda.</p>}

      <ul className="space-y-2">
        {linhas.map((l) =>
          editandoId === l.id ? (
            <UsuarioEditRow
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
                    {PAPEL_LABEL[l.papel] ?? l.papel}
                    {l.territorioNome ? ` · ${l.territorioNome}` : ""}
                    {l.expiraEm ? ` · expira em ${formatarDataUTC(l.expiraEm)}` : ""}
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
                  {podeGerenciar && l.id !== meuId ? (
                    <button
                      onClick={() => alternarAcesso(l)}
                      disabled={alterandoId === l.id}
                      className={
                        l.status === "ativo"
                          ? "rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white disabled:opacity-50"
                          : "rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 disabled:opacity-50"
                      }
                    >
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle opacity-70" />
                      {STATUS_LABEL[l.status] ?? l.status}
                    </button>
                  ) : (
                    <span
                      className={
                        l.status === "ativo"
                          ? "rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white"
                          : "rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
                      }
                      title={l.id === meuId ? "Não é possível revogar o próprio acesso por aqui" : undefined}
                    >
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle opacity-70" />
                      {STATUS_LABEL[l.status] ?? l.status}
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

function UsuarioEditRow({
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
  const [papel, setPapel] = useState(linha.papel);
  const [territorioId, setTerritorioId] = useState(linha.territorioId ?? "");
  const [expiraEm, setExpiraEm] = useState(linha.expiraEm ? linha.expiraEm.slice(0, 10) : "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const precisaTerritorio = papel === "embaixador";

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (precisaTerritorio && (!territorioId || !expiraEm)) {
      setErro("Embaixador precisa de território e data de expiração.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase
      .from("usuarios_internos")
      .update({
        nome: nome.trim(),
        papel,
        territorio_id: precisaTerritorio ? territorioId : null,
        expira_em: precisaTerritorio ? expiraEm : null,
        exige_mfa: MFA_OBRIGATORIO.has(papel),
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
            <label className="block text-xs font-medium text-neutral-500">Papel</label>
            <select
              value={papel}
              onChange={(e) => setPapel(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {PAPEIS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {precisaTerritorio && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-500">Território</label>
              <select
                value={territorioId}
                onChange={(e) => setTerritorioId(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              >
                <option value="">selecione…</option>
                {territorios.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome_bairro}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-500">Expira em</label>
              <input
                type="date"
                value={expiraEm}
                onChange={(e) => setExpiraEm(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        )}

        {MFA_OBRIGATORIO.has(papel) && (
          <p className="text-xs text-neutral-500">MFA obrigatório para este papel.</p>
        )}

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
