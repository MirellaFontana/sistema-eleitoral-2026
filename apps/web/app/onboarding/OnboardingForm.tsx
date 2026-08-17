"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PARTIDOS } from "@/lib/partidos";

const CARGOS = ["deputado estadual", "deputado federal", "senador", "governador"];
const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function OnboardingForm() {
  const router = useRouter();
  const supabase = createClient();

  const [nomeCandidato, setNomeCandidato] = useState("");
  const [cargo, setCargo] = useState(CARGOS[0]);
  const [uf, setUf] = useState("SP");
  const [partido, setPartido] = useState("");
  const [planoContratado, setPlanoContratado] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.rpc("bootstrap_campanha", {
      p_nome_candidato: nomeCandidato,
      p_cargo: cargo,
      p_uf: uf,
      p_partido: partido,
      p_plano_contratado: planoContratado,
      p_nome_usuario: nomeUsuario,
      p_telefone: telefone.trim(),
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    router.push("/usuarios");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Cadastrar a campanha</h1>
        <p className="text-sm text-neutral-500">
          Isso acontece uma única vez — cria a campanha e te registra como coordenação.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="nomeUsuario" className="block text-sm font-medium">
          Seu nome
        </label>
        <input
          id="nomeUsuario"
          required
          value={nomeUsuario}
          onChange={(e) => setNomeUsuario(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="telefone" className="block text-sm font-medium">
          Seu telefone (WhatsApp)
        </label>
        <input
          id="telefone"
          required
          placeholder="+55819..."
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="nomeCandidato" className="block text-sm font-medium">
          Nome do candidato
        </label>
        <input
          id="nomeCandidato"
          required
          value={nomeCandidato}
          onChange={(e) => setNomeCandidato(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="cargo" className="block text-sm font-medium">
            Cargo
          </label>
          <select
            id="cargo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            {CARGOS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="uf" className="block text-sm font-medium">
            UF
          </label>
          <select
            id="uf"
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="partido" className="block text-sm font-medium">
          Partido
        </label>
        <select
          id="partido"
          required
          value={partido}
          onChange={(e) => setPartido(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          <option value="">Selecione</option>
          {PARTIDOS.map((p) => (
            <option key={p.numero} value={p.sigla}>{p.numero} - {p.sigla}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="plano" className="block text-sm font-medium">
          Plano contratado
        </label>
        <input
          id="plano"
          value={planoContratado}
          onChange={(e) => setPlanoContratado(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      <p className="text-xs text-neutral-400">
        Número do candidato, nome de urna, CNPJ da campanha e coligação podem ser
        preenchidos depois em Administração → Usuários.
      </p>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Criando…" : "Criar campanha"}
      </button>
    </form>
  );
}
