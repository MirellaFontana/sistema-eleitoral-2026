"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Campanha = {
  id: string;
  nome_candidato: string;
  cargo: string | null;
  uf: string | null;
  status: string;
  created_at: string;
};

const CARGOS = ["deputado estadual", "deputado federal", "senador", "governador", "prefeito", "vereador"];
const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ativa: { label: "Ativa", cls: "bg-green-100 text-green-700" },
  suspensa: { label: "Suspensa", cls: "bg-yellow-100 text-yellow-700" },
  encerrada: { label: "Encerrada", cls: "bg-neutral-100 text-neutral-500" },
};

export function AdvClientes({
  campanhas,
  campanhaAtualId,
}: {
  campanhas: Campanha[];
  campanhaAtualId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [aberto, setAberto] = useState(false);
  const [nomeCandidato, setNomeCandidato] = useState("");
  const [cargo, setCargo] = useState(CARGOS[0]);
  const [uf, setUf] = useState("PR");
  const [partido, setPartido] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function criarCliente(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.rpc("criar_campanha_advogado", {
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

  function acessar(id: string) {
    router.push(`/adv/clientes/${id}`);
  }

  return (
    <>
      {!aberto ? (
        <button
          onClick={() => setAberto(true)}
          className="w-full rounded border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:border-teal-400 hover:text-teal-600 transition"
        >
          + Novo cliente
        </button>
      ) : (
        <form onSubmit={criarCliente} className="space-y-3 rounded border border-teal-200 bg-teal-50/30 p-4">
          <p className="text-sm font-medium">Novo cliente</p>

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
              className="rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {carregando ? "Criando…" : "Criar cliente"}
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
      )}

      {campanhas.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Nenhum cliente cadastrado. Crie o primeiro acima.
        </p>
      ) : (
        <ul className="space-y-2">
          {campanhas.map((c) => {
            const s = STATUS_LABEL[c.status] ?? { label: c.status, cls: "bg-neutral-100" };
            const isAtual = c.id === campanhaAtualId;

            return (
              <li
                key={c.id}
                className={`rounded border p-3 space-y-1 cursor-pointer transition hover:border-teal-300 hover:bg-teal-50/30 ${
                  isAtual ? "border-teal-300 bg-teal-50/20" : "border-neutral-200"
                }`}
                onClick={() => acessar(c.id)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{c.nome_candidato}</p>
                  <div className="flex items-center gap-2">
                    {isAtual && (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                        Atual
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-neutral-400">
                  {[c.cargo, c.uf].filter(Boolean).join(" — ") || "Cargo não definido"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
