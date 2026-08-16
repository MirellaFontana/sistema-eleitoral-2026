"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  VAGAS_DEP_FEDERAL,
  VAGAS_DEP_ESTADUAL,
  VAGAS_DEP_DISTRITAL,
} from "@/lib/regras-eleitorais";

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const CARGOS = [
  { value: "deputado_federal", label: "Deputado Federal" },
  { value: "deputado_estadual", label: "Deputado Estadual" },
  { value: "deputado_distrital", label: "Deputado Distrital" },
  { value: "vereador", label: "Vereador" },
];

function vagasAutomaticas(cargo: string, estado: string): number | null {
  if (cargo === "deputado_federal") return VAGAS_DEP_FEDERAL[estado] ?? null;
  if (cargo === "deputado_estadual") return VAGAS_DEP_ESTADUAL[estado] ?? null;
  if (cargo === "deputado_distrital") return VAGAS_DEP_DISTRITAL;
  return null;
}

export function EleicaoForm() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [cargo, setCargo] = useState("");
  const [estado, setEstado] = useState("");
  const [vagas, setVagas] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function handleCargoEstado(nextCargo: string, nextEstado: string) {
    setCargo(nextCargo);
    setEstado(nextEstado);
    const auto = vagasAutomaticas(nextCargo, nextEstado);
    if (auto) setVagas(String(auto));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    const res = await fetch("/api/chapas-proporcionais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cargo, estado, vagas: Number(vagas), ano: 2026 }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.error ?? "Erro ao criar eleição.");
      setSalvando(false);
      return;
    }

    setSalvando(false);
    setAberto(false);
    setCargo("");
    setEstado("");
    setVagas("");
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={() => setAberto(!aberto)}
        className="inline-flex items-center gap-1.5 rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
      >
        {aberto ? <X size={14} /> : <Plus size={14} />}
        {aberto ? "Cancelar" : "Nova Eleição"}
      </button>

      {aberto && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-neutral-200 p-4 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Cadastrar eleição proporcional
          </h2>

          {!!erro && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Cargo *</span>
              <select
                required
                value={cargo}
                onChange={(e) => handleCargoEstado(e.target.value, estado)}
                className="w-full rounded border px-2.5 py-1.5 text-sm"
              >
                <option value="">Selecione</option>
                {CARGOS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Estado *</span>
              <select
                required
                value={estado}
                onChange={(e) => handleCargoEstado(cargo, e.target.value)}
                className="w-full rounded border px-2.5 py-1.5 text-sm"
              >
                <option value="">Selecione</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Vagas *</span>
              <input
                type="number"
                required
                min={1}
                value={vagas}
                onChange={(e) => setVagas(e.target.value)}
                className="w-full rounded border px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Criar Eleição"}
          </button>
        </form>
      )}
    </div>
  );
}
