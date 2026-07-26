"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tema = { id: string; nome: string };

export function ItemForm({ campanhaId, temas }: { campanhaId: string; temas: Tema[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [temaId, setTemaId] = useState(temas[0]?.id ?? "");

  // `temas` vem do servidor e pode chegar vazio no primeiro render (antes de existir tema
  // nenhum) — sem isso, o estado ficava travado em "" mesmo depois de um tema ser criado.
  useEffect(() => {
    if (temas.length > 0 && !temas.some((t) => t.id === temaId)) {
      setTemaId(temas[0].id);
    }
  }, [temas, temaId]);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!temaId) {
      setErro("Crie um tema antes de adicionar um item.");
      return;
    }
    if (!descricao.trim() && !arquivo) {
      setErro("Preencha a descrição ou anexe um arquivo (pelo menos um dos dois).");
      return;
    }

    setCarregando(true);

    const { data: novoItem, error } = await supabase
      .from("base_conhecimento_itens")
      .insert({ campanha_id: campanhaId, tema_id: temaId, titulo, descricao: descricao.trim() || null })
      .select("id")
      .single();

    if (error || !novoItem) {
      setCarregando(false);
      setErro(error?.message ?? "erro ao criar item");
      return;
    }

    if (arquivo) {
      const caminho = `${campanhaId}/${novoItem.id}/${Date.now()}-${arquivo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("base-conhecimento")
        .upload(caminho, arquivo);

      if (uploadError) {
        setCarregando(false);
        setErro(uploadError.message);
        return;
      }

      const { error: arquivoError } = await supabase.from("base_conhecimento_arquivos").insert({
        item_id: novoItem.id,
        campanha_id: campanhaId,
        arquivo_path: caminho,
        arquivo_nome_original: arquivo.name,
      });

      if (arquivoError) {
        setCarregando(false);
        setErro(arquivoError.message);
        return;
      }
    }

    setCarregando(false);
    setSucesso(`"${titulo}" adicionado.`);
    setTimeout(() => setSucesso(null), 3000);
    setTitulo("");
    setDescricao("");
    setArquivo(null);
    router.refresh();
  }

  if (temas.length === 0) {
    return (
      <p className="text-sm text-neutral-500">Crie um tema acima antes de adicionar itens.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Tema</label>
          <select
            value={temaId}
            onChange={(e) => setTemaId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {temas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Título</label>
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Descrição (opcional se anexar arquivo)
        </label>
        <textarea
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Arquivo (PDF — opcional se preencher descrição)
        </label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Salvando…" : "Adicionar item"}
      </button>
    </form>
  );
}
