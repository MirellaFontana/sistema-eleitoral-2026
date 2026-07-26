"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";

// Combos pré-definidos — descrição em linguagem natural, o backend só recebe strings.
// Adicionar/remover combos é uma mudança de uma linha aqui, sem migration.
const COMBOS_PRE = [
  { id: "wa_idosos",       publico_alvo: "idosos",             canal: "WhatsApp",             rotulo: "WhatsApp — idosos" },
  { id: "ig_jovens",       publico_alvo: "jovens (18–25)",     canal: "Instagram (post curto)", rotulo: "Instagram — jovens" },
  { id: "reel_jovens",     publico_alvo: "jovens (18–25)",     canal: "Reel / TikTok",        rotulo: "Reel/TikTok — jovens" },
  { id: "email_empresa",   publico_alvo: "empresários",         canal: "E-mail",               rotulo: "E-mail — empresários" },
  { id: "fala_evento",     publico_alvo: "público de evento",   canal: "Fala presencial",      rotulo: "Fala em evento" },
  { id: "wa_trab",         publico_alvo: "trabalhadores",       canal: "WhatsApp",             rotulo: "WhatsApp — trabalhadores" },
];

const LIMITE_MENSAGEM = 4000;
const LIMITE_ADAPTACOES = 6;

type Variacao = {
  id: string;
  publico_alvo: string;
  canal: string;
  variacao: string;
  created_at: string;
};

type Falha = {
  publico_alvo: string;
  canal: string;
  erro?: string;
};

export function AdaptarForm() {
  const router = useRouter();
  const [mensagem, setMensagem] = useState("");
  const [combosMarcados, setCombosMarcados] = useState<Set<string>>(new Set());
  const [publicoCustom, setPublicoCustom] = useState("");
  const [canalCustom, setCanalCustom] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [variacoes, setVariacoes] = useState<Variacao[] | null>(null);
  const [falhas, setFalhas] = useState<Falha[]>([]);
  const [copiado, setCopiado] = useState<string | null>(null);

  const adaptacoesEscolhidas = useMemo(() => {
    const lista = COMBOS_PRE.filter((c) => combosMarcados.has(c.id)).map((c) => ({
      publico_alvo: c.publico_alvo,
      canal: c.canal,
    }));
    if (publicoCustom.trim() && canalCustom.trim()) {
      lista.push({
        publico_alvo: publicoCustom.trim(),
        canal: canalCustom.trim(),
      });
    }
    return lista;
  }, [combosMarcados, publicoCustom, canalCustom]);

  const totalEscolhidas = adaptacoesEscolhidas.length;
  const acimaLimite = totalEscolhidas > LIMITE_ADAPTACOES;

  function alternarCombo(id: string) {
    const proximo = new Set(combosMarcados);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    setCombosMarcados(proximo);
  }

  async function gerar() {
    setErro(null);
    setFalhas([]);
    if (!mensagem.trim()) {
      setErro("Escreva a mensagem central.");
      return;
    }
    if (totalEscolhidas === 0) {
      setErro("Escolha ao menos uma adaptação.");
      return;
    }
    if (acimaLimite) {
      setErro(`Máximo de ${LIMITE_ADAPTACOES} adaptações por vez.`);
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch("/api/marketing/adaptar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mensagem_central: mensagem,
          adaptacoes: adaptacoesEscolhidas,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao gerar variações");
        return;
      }
      setVariacoes(data.variacoes ?? []);
      setFalhas(data.falhas ?? []);
      router.refresh();
    } catch {
      setErro("Falha de conexão ao gerar variações. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  async function copiar(id: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado((atual) => (atual === id ? null : atual)), 1500);
    } catch {
      // sem clipboard permission — usuário pode selecionar manualmente
    }
  }

  const podeGerar = !!mensagem.trim() && totalEscolhidas > 0 && !acimaLimite && !carregando;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-neutral-600">
          Mensagem central (mensagem-mãe)
        </label>
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={5}
          maxLength={LIMITE_MENSAGEM}
          placeholder="Ex.: Vamos ampliar o transporte público noturno em toda a região metropolitana, começando pelas linhas do trabalhador que sai depois das 22h."
          className="w-full rounded border border-neutral-300 p-2 text-sm"
        />
        <p className="text-xs text-neutral-400">
          {mensagem.length}/{LIMITE_MENSAGEM} caracteres — a IA não vai inventar dados fora
          desta mensagem e da base de conhecimento.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-neutral-600">
          Para quem adaptar (marque os combos)
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COMBOS_PRE.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-start gap-2 rounded border p-2 text-sm ${
                combosMarcados.has(c.id)
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <input
                type="checkbox"
                checked={combosMarcados.has(c.id)}
                onChange={() => alternarCombo(c.id)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium text-neutral-800">{c.rotulo}</span>
                <span className="block text-xs text-neutral-500">
                  público: {c.publico_alvo} · canal: {c.canal}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded border border-dashed border-neutral-300 p-3">
        <p className="mb-2 text-xs font-medium text-neutral-600">
          Ou defina uma adaptação sob medida
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={publicoCustom}
            onChange={(e) => setPublicoCustom(e.target.value)}
            placeholder="Público-alvo (ex.: pequenos comerciantes)"
            maxLength={80}
            className="flex-1 rounded border border-neutral-300 p-2 text-sm"
          />
          <input
            value={canalCustom}
            onChange={(e) => setCanalCustom(e.target.value)}
            placeholder="Canal (ex.: SMS)"
            maxLength={80}
            className="flex-1 rounded border border-neutral-300 p-2 text-sm"
          />
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          Preencha os dois pra adicionar como uma adaptação extra.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={gerar}
          disabled={!podeGerar}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {carregando
            ? `Gerando ${totalEscolhidas} variação(ões)…`
            : `Gerar ${totalEscolhidas || ""} variação(ões)`.trim()}
        </button>
        {acimaLimite && (
          <span className="text-xs text-red-600">
            Máximo {LIMITE_ADAPTACOES} adaptações por vez ({totalEscolhidas} selecionadas).
          </span>
        )}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {variacoes && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-400">
            Variações mantêm a essência da mensagem central — sempre revise antes de publicar.
          </p>
          {variacoes.length === 0 && (
            <p className="text-sm text-neutral-500">Nenhuma variação foi gerada.</p>
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {variacoes.map((v) => (
              <div key={v.id} className="rounded border border-neutral-200 bg-white p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">
                      {v.publico_alvo}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">
                      {v.canal}
                    </span>
                  </div>
                  <button
                    onClick={() => copiar(v.id, v.variacao)}
                    className="flex items-center gap-1 rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                    title="Copiar texto"
                  >
                    {copiado === v.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiado === v.id ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm text-neutral-800">{v.variacao}</p>
              </div>
            ))}
          </div>
          {falhas.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">
                {falhas.length} adaptação(ões) falhou/falharam:
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
                {falhas.map((f, i) => (
                  <li key={i}>
                    {f.publico_alvo} · {f.canal}: {f.erro ?? "erro desconhecido"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
