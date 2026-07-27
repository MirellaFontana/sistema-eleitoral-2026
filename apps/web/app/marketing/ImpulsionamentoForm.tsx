"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";

const OBJETIVOS = [
  { value: "alcance", label: "Alcance (marca / notoriedade)" },
  { value: "trafego", label: "Tráfego (cliques pro link)" },
  { value: "engajamento", label: "Engajamento (curtidas, comentários, shares)" },
  { value: "video_views", label: "Visualizações de vídeo" },
  { value: "conversao", label: "Conversão (cadastros, doações, mensagens)" },
  { value: "mensagens", label: "Mensagens (WhatsApp / DM)" },
  { value: "seguidores", label: "Seguidores (crescimento da conta)" },
];

export function ImpulsionamentoForm() {
  const router = useRouter();

  const [pecaDescricao, setPecaDescricao] = useState("");
  const [objetivo, setObjetivo] = useState(OBJETIVOS[1].value);
  const [publico, setPublico] = useState("");
  const [orcamento, setOrcamento] = useState<string>("");
  const [prazo, setPrazo] = useState<string>("7");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const orc = Number(orcamento);
    const prz = Number(prazo);
    if (!Number.isFinite(orc) || orc <= 0) {
      setErro("Informe um orçamento válido em R$.");
      return;
    }
    if (!Number.isFinite(prz) || prz <= 0) {
      setErro("Informe um prazo válido em dias.");
      return;
    }

    setGerando(true);
    try {
      const res = await fetch("/api/marketing/impulsionamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peca_descricao: pecaDescricao.trim(),
          objetivo,
          publico_prioritario: publico.trim(),
          orcamento_total: orc,
          prazo_dias: prz,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro ao gerar plano de impulsionamento");
      } else {
        setPecaDescricao("");
        setPublico("");
        setOrcamento("");
        router.refresh();
      }
    } catch {
      setErro("Erro de rede");
    }
    setGerando(false);
  }

  return (
    <form onSubmit={gerar} className="space-y-3 rounded border border-neutral-200 p-4">
      <p className="text-xs text-neutral-500">
        Método Pedro Sobral adaptado a campanha eleitoral BR — a IA monta estrutura CBO, teste
        3×3 (públicos × criativos), benchmarks, kill rules, escala matemática e compliance
        eleitoral (autorização Meta, CNPJ, número, selo IA).
      </p>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Descrição / copy da peça a impulsionar
        </label>
        <textarea
          rows={4}
          value={pecaDescricao}
          onChange={(e) => setPecaDescricao(e.target.value)}
          required
          placeholder="Cole a copy ou descreva a peça. A IA usa isso pra gerar variações de criativo."
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Objetivo Meta</label>
          <select
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {OBJETIVOS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Público prioritário</label>
          <input
            type="text"
            value={publico}
            onChange={(e) => setPublico(e.target.value)}
            required
            placeholder="Ex.: mulheres 35-55, região metropolitana de Curitiba"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Orçamento total (R$)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={orcamento}
            onChange={(e) => setOrcamento(e.target.value)}
            required
            placeholder="Ex.: 5000"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Prazo (dias)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            required
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={gerando}
        className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        <Rocket size={12} strokeWidth={2} />
        {gerando ? "Gerando plano…" : "Gerar plano de impulsionamento"}
      </button>
    </form>
  );
}
