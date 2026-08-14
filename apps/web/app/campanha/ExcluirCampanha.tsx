"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function ExcluirCampanha({
  campanhaId,
  nomeCandidato,
}: {
  campanhaId: string;
  nomeCandidato: string;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"idle" | "confirmar" | "excluindo">("idle");
  const [digitado, setDigitado] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
    setEtapa("excluindo");
    setErro(null);
    try {
      const res = await fetch("/api/campanha", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campanhaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao excluir");
        setEtapa("confirmar");
        return;
      }
      router.push("/login");
    } catch {
      setErro("Falha de conexão.");
      setEtapa("confirmar");
    }
  }

  if (etapa === "idle") {
    return (
      <button
        type="button"
        onClick={() => setEtapa("confirmar")}
        className="flex items-center gap-1.5 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
      >
        <Trash2 size={14} />
        Excluir campanha
      </button>
    );
  }

  const nomeConfere = digitado.trim().toLowerCase() === nomeCandidato.trim().toLowerCase();

  return (
    <div className="rounded border border-red-300 bg-red-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-red-800">
        Tem certeza? Todos os dados desta campanha serão permanentemente excluídos.
      </p>
      <p className="text-xs text-red-600">
        Para confirmar, digite o nome do candidato: <strong>{nomeCandidato}</strong>
      </p>
      <input
        value={digitado}
        onChange={(e) => setDigitado(e.target.value)}
        placeholder={nomeCandidato}
        className="w-full rounded border border-red-300 px-2 py-1.5 text-sm"
      />
      {erro && <p className="text-sm text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!nomeConfere || etapa === "excluindo"}
          onClick={excluir}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {etapa === "excluindo" ? "Excluindo…" : "Excluir definitivamente"}
        </button>
        <button
          type="button"
          onClick={() => { setEtapa("idle"); setDigitado(""); setErro(null); }}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
