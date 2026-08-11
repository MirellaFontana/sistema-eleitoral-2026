"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TIPOS = [
  { value: "representacao", label: "Representação" },
  { value: "aije", label: "AIJE" },
  { value: "aime", label: "AIME" },
  { value: "recurso", label: "Recurso" },
  { value: "notificacao", label: "Notificação" },
  { value: "outro", label: "Outro" },
];

export function ProcessoForm({ campanhaId }: { campanhaId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("representacao");
  const [tribunal, setTribunal] = useState("TRE-PR");
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [parteAutora, setParteAutora] = useState("");
  const [parteRe, setParteRe] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const { error } = await supabase.from("processos_eleitorais").insert({
      campanha_id: campanhaId,
      titulo,
      tipo,
      tribunal: tribunal.trim() || "TRE-PR",
      numero_processo: numeroProcesso.trim() || null,
      parte_autora: parteAutora.trim() || null,
      parte_re: parteRe.trim() || null,
      descricao: descricao.trim() || null,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso("Processo registrado.");
    setTimeout(() => setSucesso(null), 3000);
    setTitulo("");
    setTipo("representacao");
    setTribunal("TRE-PR");
    setNumeroProcesso("");
    setParteAutora("");
    setParteRe("");
    setDescricao("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Título</label>
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Representação contra propaganda irregular de Fulano"
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Tribunal</label>
          <input
            value={tribunal}
            onChange={(e) => setTribunal(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Nº do processo</label>
          <input
            value={numeroProcesso}
            onChange={(e) => setNumeroProcesso(e.target.value)}
            placeholder="Preencher após protocolo"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Parte autora</label>
          <input
            value={parteAutora}
            onChange={(e) => setParteAutora(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Parte ré</label>
          <input
            value={parteRe}
            onChange={(e) => setParteRe(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Descrição</label>
        <textarea
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Fatos, fundamento jurídico, pedidos…"
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
        {carregando ? "Salvando…" : "Registrar processo"}
      </button>
    </form>
  );
}
