"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { labelTerritorio } from "@/lib/territorio";

type Opcao = { id: string; nome: string };
type OpcaoTerritorio = { id: string; nome_bairro: string | null; cidade: string | null };

const CIRCULO_LABEL: Record<string, string> = { quente: "Quente", morno: "Morno", frio: "Frio" };

type Linha = {
  id: string;
  nome: string;
  whatsapp: string;
  email: string | null;
  cidade: string | null;
  circulo: string;
  status: string;
  liderancaId: string | null;
  liderancaNome: string | null;
  territorioId: string | null;
  territorioLabel: string;
  createdAt: string;
};

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function CidadaoTable({
  linhas,
  liderancas,
  territorios,
  podeGerenciar,
}: {
  linhas: Linha[];
  liderancas: Opcao[];
  territorios: OpcaoTerritorio[];
  podeGerenciar: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busca, setBusca] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [visualizandoId, setVisualizandoId] = useState<string | null>(null);
  const [alterandoStatusId, setAlterandoStatusId] = useState<string | null>(null);

  const filtradas = linhas.filter((l) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return [l.nome, l.whatsapp, l.cidade, l.territorioLabel, l.liderancaNome].some((v) =>
      v?.toLowerCase().includes(q)
    );
  });

  async function toggleStatus(l: Linha) {
    setAlterandoStatusId(l.id);
    await supabase
      .from("cidadaos")
      .update({ status: l.status === "ativo" ? "inativo" : "ativo" })
      .eq("id", l.id);
    setAlterandoStatusId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <input
        placeholder="Buscar eleitor…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="w-full max-w-xs rounded border border-neutral-300 px-2 py-1.5 text-sm"
      />

      {filtradas.length === 0 && <p className="text-sm text-neutral-400">Nenhum eleitor encontrado.</p>}

      <ul className="space-y-2">
        {filtradas.map((l) =>
          editandoId === l.id ? (
            <CidadaoEditRow
              key={l.id}
              linha={l}
              liderancas={liderancas}
              territorios={territorios}
              onCancelar={() => setEditandoId(null)}
              onSalvo={() => {
                setEditandoId(null);
                router.refresh();
              }}
            />
          ) : visualizandoId === l.id ? (
            <CidadaoViewRow key={l.id} linha={l} onFechar={() => setVisualizandoId(null)} />
          ) : (
            <li key={l.id} className="rounded border border-neutral-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{l.nome}</p>
                  <p className="text-xs text-neutral-500">
                    {l.whatsapp} · {CIRCULO_LABEL[l.circulo] ?? l.circulo}
                    {l.cidade ? ` · ${l.cidade}` : ""} · {l.territorioLabel}
                    {l.liderancaNome ? ` · ${l.liderancaNome}` : ""} · {formatarData(l.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVisualizandoId(l.id)}
                    className="flex items-center gap-1 rounded border border-neutral-300 px-2.5 py-0.5 text-xs font-medium hover:bg-neutral-50"
                  >
                    <Eye size={12} strokeWidth={2} aria-hidden="true" />
                    Visualizar
                  </button>
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
                      disabled={alterandoStatusId === l.id}
                      className={
                        l.status === "ativo"
                          ? "rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white disabled:opacity-50"
                          : "rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500 disabled:opacity-50"
                      }
                    >
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle opacity-70" />
                      {l.status === "ativo" ? "Ativo" : "Inativo"}
                    </button>
                  ) : (
                    <span
                      className={
                        l.status === "ativo"
                          ? "rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white"
                          : "rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500"
                      }
                    >
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle opacity-70" />
                      {l.status === "ativo" ? "Ativo" : "Inativo"}
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

function Campo({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="text-sm">{valor}</p>
    </div>
  );
}

function CidadaoViewRow({ linha, onFechar }: { linha: Linha; onFechar: () => void }) {
  return (
    <li className="rounded border border-neutral-300 bg-neutral-50 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Nome" valor={linha.nome} />
        <Campo label="WhatsApp" valor={linha.whatsapp} />
        <Campo label="E-mail" valor={linha.email ?? "não informado"} />
        <Campo label="Cidade" valor={linha.cidade ?? "não informado"} />
        <Campo label="Temperatura do voto" valor={CIRCULO_LABEL[linha.circulo] ?? linha.circulo} />
        <Campo label="Bairro/território" valor={linha.territorioLabel} />
        <Campo label="Liderança" valor={linha.liderancaNome ?? "Iniciativa própria"} />
        <Campo label="Status" valor={linha.status === "ativo" ? "Ativo" : "Inativo"} />
        <Campo label="Cadastrado em" valor={formatarData(linha.createdAt)} />
      </div>
      <button
        type="button"
        onClick={onFechar}
        className="mt-3 flex items-center gap-1.5 rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
      >
        <X size={14} strokeWidth={2} aria-hidden="true" />
        Fechar
      </button>
    </li>
  );
}

function CidadaoEditRow({
  linha,
  liderancas,
  territorios,
  onCancelar,
  onSalvo,
}: {
  linha: Linha;
  liderancas: Opcao[];
  territorios: OpcaoTerritorio[];
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const supabase = createClient();

  const [nome, setNome] = useState(linha.nome);
  const [whatsapp, setWhatsapp] = useState(linha.whatsapp);
  const [email, setEmail] = useState(linha.email ?? "");
  const [cidade, setCidade] = useState(linha.cidade ?? "");
  const [circulo, setCirculo] = useState(linha.circulo);
  const [liderancaId, setLiderancaId] = useState(linha.liderancaId ?? "");
  const [territorioId, setTerritorioId] = useState(linha.territorioId ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    const { error } = await supabase
      .from("cidadaos")
      .update({
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim() || null,
        cidade: cidade.trim() || null,
        circulo,
        // origem_cadastro precisa acompanhar lideranca_id: o banco exige lideranca_id quando
        // origem é "formulario_lideranca" — limpar a liderança sem isso violaria a constraint.
        lideranca_id: liderancaId || null,
        origem_cadastro: liderancaId ? "formulario_lideranca" : "iniciativa_propria",
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
            <label className="block text-xs font-medium text-neutral-500">WhatsApp</label>
            <input
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Cidade</label>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Bairro/território</label>
            <select
              value={territorioId}
              onChange={(e) => setTerritorioId(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">não informado</option>
              {territorios.map((t) => (
                <option key={t.id} value={t.id}>
                  {labelTerritorio(t.nome_bairro, t.cidade)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Temperatura do voto</label>
            <select
              value={circulo}
              onChange={(e) => setCirculo(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="frio">Frio</option>
              <option value="morno">Morno</option>
              <option value="quente">Quente</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">
            Liderança <span className="font-normal text-neutral-400">(opcional)</span>
          </label>
          <select
            value={liderancaId}
            onChange={(e) => setLiderancaId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">Nenhuma — iniciativa própria</option>
            {liderancas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
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
