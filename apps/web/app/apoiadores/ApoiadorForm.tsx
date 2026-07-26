"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { labelTerritorio } from "@/lib/territorio";

type Territorio = { id: string; nome_bairro: string | null; cidade: string | null };
type Cidadao = { id: string; nome: string };

const FORMAS_AJUDA = [
  { value: "transporte", label: "Transporte" },
  { value: "espaco_reuniao", label: "Espaço pra reunião" },
  { value: "redes_sociais", label: "Redes sociais" },
  { value: "distribuicao_material", label: "Distribuição de material" },
  { value: "tempo_voluntario", label: "Tempo voluntário" },
  { value: "doacao_material", label: "Doação de material" },
  { value: "outro", label: "Outro" },
];

export function ApoiadorForm({
  campanhaId,
  territorios,
  cidadaos,
}: {
  campanhaId: string;
  territorios: Territorio[];
  cidadaos: Cidadao[] | null; // null = papel sem permissão de vincular (nem vê o campo)
}) {
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [territorioId, setTerritorioId] = useState("");
  const [cidadaoId, setCidadaoId] = useState("");
  const [formasAjuda, setFormasAjuda] = useState<string[]>([]);
  const [detalheAjuda, setDetalheAjuda] = useState("");
  const [disponibilidade, setDisponibilidade] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function toggleForma(value: string) {
    setFormasAjuda((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const { error } = await supabase.from("apoiadores").insert({
      campanha_id: campanhaId,
      nome: nome.trim(),
      telefone: telefone.trim(),
      cidade: cidade.trim() || null,
      bairro: bairro.trim() || null,
      territorio_id: territorioId || null,
      cidadao_id: cidadaoId || null,
      formas_ajuda: formasAjuda,
      detalhe_ajuda: detalheAjuda.trim() || null,
      disponibilidade: disponibilidade.trim() || null,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso(`Apoiador "${nome}" cadastrado.`);
    setTimeout(() => setSucesso(null), 3000);
    setNome("");
    setTelefone("");
    setCidade("");
    setBairro("");
    setTerritorioId("");
    setCidadaoId("");
    setFormasAjuda([]);
    setDetalheAjuda("");
    setDisponibilidade("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
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
            placeholder="+55819..."
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
          <label className="block text-xs font-medium text-neutral-500">Território (mapa, opcional)</label>
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

      {cidadaos !== null && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">
            Já é eleitor cadastrado? (opcional — evita duplicar o cadastro)
          </label>
          <select
            value={cidadaoId}
            onChange={(e) => setCidadaoId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">não / não sei</option>
            {cidadaos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Como pode ajudar</label>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {FORMAS_AJUDA.map((f) => (
            <label key={f.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={formasAjuda.includes(f.value)}
                onChange={() => toggleForma(f.value)}
              />
              {f.label}
            </label>
          ))}
        </div>
        {formasAjuda.includes("doacao_material") && (
          <p className="flex items-start gap-1 text-xs text-amber-700">
            <AlertTriangle size={12} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
            Doação em espécie ou material pode ter que constar na prestação de contas eleitoral
            (Lei 9.504/1997) — confirme com o jurídico antes de aceitar.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Detalhe (opcional)</label>
          <input
            placeholder="ex.: tem carro, disponível pra buscar material"
            value={detalheAjuda}
            onChange={(e) => setDetalheAjuda(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Disponibilidade (opcional)</label>
          <input
            placeholder="ex.: fins de semana, à noite"
            value={disponibilidade}
            onChange={(e) => setDisponibilidade(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Cadastrando…" : "Cadastrar apoiador"}
      </button>
    </form>
  );
}
