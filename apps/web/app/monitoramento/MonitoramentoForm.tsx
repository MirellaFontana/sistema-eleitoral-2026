"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CATEGORIAS = [
  { value: "ameaca_juridica", label: "Ameaça jurídica" },
  { value: "deepfake_suspeito", label: "Deepfake suspeito" },
  { value: "gestao_crise", label: "Gestão de crise" },
  { value: "mencao_positiva", label: "Menção positiva" },
  { value: "mencao_neutra", label: "Menção neutra" },
  { value: "mencao_negativa", label: "Menção negativa" },
  { value: "oportunidade_marketing", label: "Oportunidade de marketing" },
  { value: "outro", label: "Outro" },
];

const CATEGORIAS_COM_GRAVIDADE = new Set(["ameaca_juridica", "deepfake_suspeito", "gestao_crise"]);
// Mesmas 3 categorias recebem hash de evidência (escudo antideepfake) — .pipeline/specs.md [2026-07-15].
const CATEGORIAS_COM_EVIDENCIA = CATEGORIAS_COM_GRAVIDADE;

async function calcularHashSha256(arquivo: File): Promise<string> {
  const buffer = await arquivo.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const GRAVIDADES = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

export function MonitoramentoForm({
  campanhaId,
  prefillUrl,
  prefillDescricao,
}: {
  campanhaId: string;
  prefillUrl?: string;
  prefillDescricao?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const formRef = useRef<HTMLFormElement>(null);

  const [categoria, setCategoria] = useState(CATEGORIAS[0].value);
  const [gravidade, setGravidade] = useState("");
  const [url, setUrl] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Item escolhido no painel de busca automática — só preenche, não registra sozinho.
  // A lista de resultados pode ter 15+ notícias empurrando o formulário pra baixo da tela;
  // sem rolar até ele, o preenchimento acontece fora da vista e parece que "nada aconteceu".
  useEffect(() => {
    if (prefillUrl === undefined && prefillDescricao === undefined) return;
    setUrl(prefillUrl ?? "");
    setDescricao(prefillDescricao ?? "");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [prefillUrl, prefillDescricao]);

  const precisaGravidade = CATEGORIAS_COM_GRAVIDADE.has(categoria);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    let capturaPath: string | null = null;
    let hashEvidencia: string | null = null;
    let hashCalculadoEm: string | null = null;

    if (arquivo) {
      const caminho = `${campanhaId}/${Date.now()}-${arquivo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("monitoramento")
        .upload(caminho, arquivo);

      if (uploadError) {
        setCarregando(false);
        setErro(uploadError.message);
        return;
      }
      capturaPath = caminho;

      // Escudo antideepfake: categoria de ameaça + arquivo captura o hash de evidência
      // automaticamente, sem ação manual — prova de cadeia de custódia (não substitui
      // notarização externa se for exigida em processo judicial).
      if (CATEGORIAS_COM_EVIDENCIA.has(categoria)) {
        hashEvidencia = await calcularHashSha256(arquivo);
        hashCalculadoEm = new Date().toISOString();
      }
    }

    const { error } = await supabase.from("monitoramento_itens").insert({
      campanha_id: campanhaId,
      categoria,
      gravidade: precisaGravidade && gravidade ? gravidade : null,
      url: url.trim() || null,
      descricao,
      captura_path: capturaPath,
      hash_evidencia: hashEvidencia,
      hash_calculado_em: hashCalculadoEm,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso("Item registrado.");
    setTimeout(() => setSucesso(null), 3000);
    setUrl("");
    setDescricao("");
    setGravidade("");
    setArquivo(null);
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-3 scroll-mt-4 rounded border border-neutral-200 p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              if (!CATEGORIAS_COM_GRAVIDADE.has(e.target.value)) setGravidade("");
            }}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {precisaGravidade && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Gravidade</label>
            <select
              value={gravidade}
              onChange={(e) => setGravidade(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">selecione…</option>
              {GRAVIDADES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Link (opcional)</label>
        <input
          type="url"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">O que foi encontrado</label>
        <textarea
          required
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Print/captura (opcional)</label>
        <input
          type="file"
          accept="image/*,video/*,audio/*,application/pdf"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
        {CATEGORIAS_COM_EVIDENCIA.has(categoria) && (
          <p className="text-xs text-neutral-500">
            Categoria de ameaça: anexar arquivo aqui calcula um hash de evidência automaticamente
            e lacra o registro (descrição/captura não podem mais ser editadas depois).
          </p>
        )}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Registrando…" : "Registrar"}
      </button>
    </form>
  );
}
