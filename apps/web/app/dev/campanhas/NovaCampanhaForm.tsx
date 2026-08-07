"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CARGOS = ["deputado estadual", "deputado federal", "senador", "governador"];
const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function NovaCampanhaForm() {
  const router = useRouter();
  const supabase = createClient();
  const [aberto, setAberto] = useState(false);
  const [nomeCandidato, setNomeCandidato] = useState("");
  const [cargo, setCargo] = useState(CARGOS[0]);
  const [uf, setUf] = useState("SP");
  const [partido, setPartido] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.rpc("criar_campanha_dev", {
      p_nome_candidato: nomeCandidato,
      p_cargo: cargo,
      p_uf: uf,
      p_partido: partido,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setNomeCandidato("");
    setPartido("");
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="w-full rounded border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:border-indigo-400 hover:text-indigo-600 transition"
      >
        + Nova campanha
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-indigo-200 bg-indigo-50/30 p-4">
      <p className="text-sm font-medium">Nova campanha</p>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Nome do candidato</label>
        <input
          required
          value={nomeCandidato}
          onChange={(e) => setNomeCandidato(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Cargo</label>
          <select
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {CARGOS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">UF</label>
          <select
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {UFS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Partido</label>
        <input
          required
          value={partido}
          onChange={(e) => setPartido(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={carregando}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {carregando ? "Criando…" : "Criar campanha"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
