"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SITUACOES = [
  { value: "apresentacao_candidatura", label: "Apresentação da candidatura" },
  { value: "confirmacao_evento", label: "Confirmação de evento" },
  { value: "agradecimento", label: "Agradecimento" },
  { value: "resposta_proposta", label: "Resposta sobre proposta" },
  { value: "convite_voluntariado", label: "Convite para voluntariado" },
  { value: "orientacao_apoiador", label: "Orientação para apoiador" },
  { value: "retorno_demanda", label: "Retorno de demanda" },
  { value: "resposta_critica", label: "Resposta a crítica" },
  { value: "esclarecimento_informacao_falsa", label: "Esclarecimento de informação falsa" },
  { value: "descadastramento", label: "Descadastramento" },
];

export function ModeloForm({ campanhaId }: { campanhaId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [situacao, setSituacao] = useState(SITUACOES[0].value);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.from("modelos_mensagem").insert({
      campanha_id: campanhaId,
      situacao,
      titulo: titulo.trim(),
      conteudo: conteudo.trim(),
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setTitulo("");
    setConteudo("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Situação</label>
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {SITUACOES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Título do modelo</label>
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Agradecimento por doação de material"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Texto do modelo</label>
        <textarea
          required
          rows={4}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Salvando…" : "Criar modelo"}
      </button>
    </form>
  );
}

export { SITUACOES };
