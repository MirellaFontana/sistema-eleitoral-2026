"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PARTIDOS } from "@/lib/partidos";

export function ConcorrenteForm({ campanhaId }: { campanhaId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome] = useState("");
  const [partido, setPartido] = useState("");
  const [pontosFortes, setPontosFortes] = useState("");
  const [pontosFracos, setPontosFracos] = useState("");
  const [promessas, setPromessas] = useState("");
  const [dossieMandato, setDossieMandato] = useState("");
  const [argumentos, setArgumentos] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const { error } = await supabase.from("concorrentes").insert({
      campanha_id: campanhaId,
      nome,
      partido: partido.trim() || null,
      pontos_fortes: pontosFortes.trim() || null,
      pontos_fracos: pontosFracos.trim() || null,
      promessas: promessas.trim() || null,
      dossie_mandato: dossieMandato.trim() || null,
      argumentos: argumentos.trim() || null,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso(`"${nome}" adicionado.`);
    setTimeout(() => setSucesso(null), 3000);
    setNome("");
    setPartido("");
    setPontosFortes("");
    setPontosFracos("");
    setPromessas("");
    setDossieMandato("");
    setArgumentos("");
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
          <label className="block text-xs font-medium text-neutral-500">Partido</label>
          <select
            value={partido}
            onChange={(e) => setPartido(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">Selecione</option>
            {PARTIDOS.map((p) => (
              <option key={p.numero} value={p.sigla}>{p.numero} - {p.sigla}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Pontos fortes</label>
        <textarea
          rows={2}
          value={pontosFortes}
          onChange={(e) => setPontosFortes(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Pontos fracos</label>
        <textarea
          rows={2}
          value={pontosFracos}
          onChange={(e) => setPontosFracos(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Promessas</label>
        <textarea
          rows={2}
          value={promessas}
          onChange={(e) => setPromessas(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Dossiê do Mandato</label>
        <textarea
          rows={3}
          value={dossieMandato}
          onChange={(e) => setDossieMandato(e.target.value)}
          placeholder="Histórico de mandatos, votações relevantes, projetos aprovados/rejeitados…"
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Argumentos</label>
        <textarea
          rows={3}
          value={argumentos}
          onChange={(e) => setArgumentos(e.target.value)}
          placeholder="Contra-argumentos e pontos de ataque para debates e comparações…"
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
        {carregando ? "Salvando…" : "Adicionar concorrente"}
      </button>
    </form>
  );
}
