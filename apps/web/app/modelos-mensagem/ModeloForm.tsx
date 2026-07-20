"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SITUACOES_SUGERIDAS = [
  "Apresentação da candidatura",
  "Confirmação de evento",
  "Agradecimento",
  "Resposta sobre proposta",
  "Convite para voluntariado",
  "Orientação para apoiador",
  "Retorno de demanda",
  "Resposta a crítica",
  "Esclarecimento de informação falsa",
  "Descadastramento",
];

export function ModeloForm({
  campanhaId,
  situacoesExistentes,
}: {
  campanhaId: string;
  situacoesExistentes: string[];
}) {
  const router = useRouter();
  const supabase = createClient();

  // Sugestões = as 10 situações originais + qualquer situação nova que a equipe já tenha
  // cadastrado (evita fragmentar em variações de grafia, tipo "Convite pra evento" vs
  // "Convite para evento").
  const sugestoes = Array.from(new Set([...SITUACOES_SUGERIDAS, ...situacoesExistentes])).sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );

  const [situacao, setSituacao] = useState("");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!situacao.trim()) {
      setErro("Informe a situação do modelo (ex.: Agradecimento).");
      return;
    }

    setCarregando(true);
    const { error } = await supabase.from("modelos_mensagem").insert({
      campanha_id: campanhaId,
      situacao: situacao.trim(),
      titulo: titulo.trim(),
      conteudo: conteudo.trim(),
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setSituacao("");
    setTitulo("");
    setConteudo("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Situação</label>
          <input
            required
            list="situacoes-sugeridas"
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            placeholder="Ex.: Agradecimento — ou digite uma situação nova"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <datalist id="situacoes-sugeridas">
            {sugestoes.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
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
