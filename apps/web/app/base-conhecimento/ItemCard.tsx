"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Arquivo = { id: string; arquivo_path: string; arquivo_nome_original: string | null };
type Item = { id: string; titulo: string; descricao: string | null };

export function ItemCard({
  item,
  arquivos,
  campanhaId,
  podeEditar,
}: {
  item: Item;
  arquivos: Arquivo[];
  campanhaId: string;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(item.titulo);
  const [descricao, setDescricao] = useState(item.descricao ?? "");
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // "Adicionar informação" nunca substitui o que já existe — só acrescenta ao final. "Editar"
  // continua existindo, separado, pra quando for corrigir/substituir de verdade.
  const [adicionandoInfo, setAdicionandoInfo] = useState(false);
  const [novaInfo, setNovaInfo] = useState("");

  // Confirmação inline (não window.confirm — trava automação de teste e é UX inconsistente
  // entre navegadores) — dois cliques: "Excluir" mostra "Confirmar / Cancelar" no lugar.
  const [confirmandoExclusaoItem, setConfirmandoExclusaoItem] = useState(false);
  const [confirmandoRemocaoArquivo, setConfirmandoRemocaoArquivo] = useState<string | null>(null);

  async function salvarEdicao() {
    setErro(null);
    setCarregando(true);
    const { error } = await supabase
      .from("base_conhecimento_itens")
      .update({ titulo, descricao: descricao.trim() || null })
      .eq("id", item.id);
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEditando(false);
    router.refresh();
  }

  async function adicionarInformacao() {
    if (!novaInfo.trim()) return;
    setErro(null);
    setCarregando(true);
    const descricaoAtualizada = item.descricao ? `${item.descricao}\n\n${novaInfo.trim()}` : novaInfo.trim();
    const { error } = await supabase
      .from("base_conhecimento_itens")
      .update({ descricao: descricaoAtualizada })
      .eq("id", item.id);
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNovaInfo("");
    setAdicionandoInfo(false);
    router.refresh();
  }

  async function excluirItem() {
    setErro(null);
    setCarregando(true);
    const { error } = await supabase.from("base_conhecimento_itens").delete().eq("id", item.id);
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    router.refresh();
  }

  async function adicionarArquivo() {
    if (!novoArquivo) return;
    setErro(null);
    setCarregando(true);

    const caminho = `${campanhaId}/${item.id}/${Date.now()}-${novoArquivo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("base-conhecimento")
      .upload(caminho, novoArquivo);

    if (uploadError) {
      setCarregando(false);
      setErro(uploadError.message);
      return;
    }

    const { error } = await supabase.from("base_conhecimento_arquivos").insert({
      item_id: item.id,
      campanha_id: campanhaId,
      arquivo_path: caminho,
      arquivo_nome_original: novoArquivo.name,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNovoArquivo(null);
    router.refresh();
  }

  async function removerArquivo(arquivoId: string) {
    setErro(null);
    setCarregando(true);
    const { error } = await supabase.from("base_conhecimento_arquivos").delete().eq("id", arquivoId);
    setCarregando(false);
    setConfirmandoRemocaoArquivo(null);
    if (error) {
      setErro(error.message);
      return;
    }
    router.refresh();
  }

  async function baixar(path: string, nome: string) {
    const { data, error } = await supabase.storage.from("base-conhecimento").createSignedUrl(path, 60);
    if (error || !data) {
      setErro(error?.message ?? "erro ao gerar link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    void nome;
  }

  if (editando) {
    return (
      <li className="rounded border border-neutral-200 p-3 space-y-2">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-medium"
        />
        <textarea
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex gap-2">
          <button
            onClick={salvarEdicao}
            disabled={carregando}
            className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Check size={13} strokeWidth={2} aria-hidden="true" />
            {carregando ? "Salvando…" : "Salvar"}
          </button>
          <button
            onClick={() => {
              setEditando(false);
              setTitulo(item.titulo);
              setDescricao(item.descricao ?? "");
              setErro(null);
            }}
            className="flex items-center gap-1 rounded border border-neutral-300 px-3 py-1 text-sm"
          >
            <X size={13} strokeWidth={2} aria-hidden="true" />
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded border border-neutral-200 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{item.titulo}</p>
        {podeEditar && !confirmandoExclusaoItem && (
          <div className="flex shrink-0 gap-3 text-xs">
            <button
              onClick={() => setAdicionandoInfo(true)}
              className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900"
            >
              <Plus size={12} strokeWidth={2} aria-hidden="true" />
              Adicionar informação
            </button>
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900"
            >
              <Pencil size={12} strokeWidth={2} aria-hidden="true" />
              Editar
            </button>
            <button
              onClick={() => setConfirmandoExclusaoItem(true)}
              className="flex items-center gap-1 text-red-600 hover:text-red-800"
            >
              <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
              Excluir
            </button>
          </div>
        )}
        {podeEditar && confirmandoExclusaoItem && (
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="text-neutral-500">Excluir este item e seus arquivos?</span>
            <button
              onClick={excluirItem}
              disabled={carregando}
              className="font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              {carregando ? "Excluindo…" : "Confirmar"}
            </button>
            <button onClick={() => setConfirmandoExclusaoItem(false)} className="text-neutral-500 hover:text-neutral-900">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {item.descricao && <p className="text-sm text-neutral-600 whitespace-pre-wrap">{item.descricao}</p>}

      {adicionandoInfo && (
        <div className="space-y-2 rounded border border-neutral-200 bg-neutral-50 p-2">
          <textarea
            autoFocus
            rows={2}
            placeholder="O que você quer acrescentar…"
            value={novaInfo}
            onChange={(e) => setNovaInfo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={adicionarInformacao}
              disabled={!novaInfo.trim() || carregando}
              className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus size={12} strokeWidth={2} aria-hidden="true" />
              {carregando ? "Adicionando…" : "Adicionar"}
            </button>
            <button
              onClick={() => {
                setAdicionandoInfo(false);
                setNovaInfo("");
                setErro(null);
              }}
              className="rounded border border-neutral-300 px-3 py-1 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {arquivos.length > 0 && (
        <ul className="space-y-1">
          {arquivos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <button
                onClick={() => baixar(a.arquivo_path, a.arquivo_nome_original ?? "arquivo")}
                className="text-neutral-900 underline underline-offset-2"
              >
                {a.arquivo_nome_original ?? "arquivo"}
              </button>
              {podeEditar && confirmandoRemocaoArquivo !== a.id && (
                <button
                  onClick={() => setConfirmandoRemocaoArquivo(a.id)}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                >
                  <X size={11} strokeWidth={2} aria-hidden="true" />
                  remover
                </button>
              )}
              {podeEditar && confirmandoRemocaoArquivo === a.id && (
                <span className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => removerArquivo(a.id)}
                    disabled={carregando}
                    className="flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 font-medium text-white disabled:opacity-50"
                  >
                    <Trash2 size={11} strokeWidth={2} aria-hidden="true" />
                    {carregando ? "…" : "Confirmar"}
                  </button>
                  <button
                    onClick={() => setConfirmandoRemocaoArquivo(null)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100"
                  >
                    <X size={11} strokeWidth={2} aria-hidden="true" />
                    Cancelar
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setNovoArquivo(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
          <button
            onClick={adicionarArquivo}
            disabled={!novoArquivo || carregando}
            className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
          >
            {carregando ? "Enviando…" : "Adicionar arquivo"}
          </button>
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </li>
  );
}
