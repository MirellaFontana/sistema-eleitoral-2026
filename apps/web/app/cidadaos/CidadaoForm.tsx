"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { labelTerritorio } from "@/lib/territorio";

type Opcao = { id: string; nome?: string; nome_bairro?: string | null; cidade?: string | null };

const TEXTO_CONSENTIMENTO_PADRAO =
  "Autorizo o uso dos meus dados de contato pela campanha para comunicação eleitoral, conforme formulário físico assinado por mim.";

export function CidadaoForm({
  campanhaId,
  liderancas,
  territorios,
}: {
  campanhaId: string;
  liderancas: Opcao[];
  territorios: Opcao[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [liderancaId, setLiderancaId] = useState("");
  const [territorioId, setTerritorioId] = useState("");
  const [circulo, setCirculo] = useState("frio");
  const [textoConsentimento, setTextoConsentimento] = useState(TEXTO_CONSENTIMENTO_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const { data: cidadao, error } = await supabase
      .from("cidadaos")
      .insert({
        campanha_id: campanhaId,
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim() || null,
        circulo,
        territorio_id: territorioId || null,
        origem_cadastro: "formulario_lideranca",
        lideranca_id: liderancaId,
      })
      .select("id")
      .single();

    if (error || !cidadao) {
      setCarregando(false);
      setErro(error?.message ?? "erro ao cadastrar eleitor");
      return;
    }

    const { error: consentError } = await supabase.from("consentimentos_lgpd").insert({
      cidadao_id: cidadao.id,
      campanha_id: campanhaId,
      finalidade: "comunicacao_de_campanha",
      base_legal: "consentimento",
      texto_aceito: textoConsentimento.trim(),
      canal_origem: "formulario_fisico",
    });

    setCarregando(false);

    if (consentError) {
      // Cadastro salvo, consentimento não — erro visível, sem esconder (LGPD).
      setErro(
        `Eleitor salvo, mas o registro de consentimento FALHOU (${consentError.message}). Regularize antes de qualquer contato.`
      );
      router.refresh();
      return;
    }

    setSucesso(`Eleitor "${nome}" cadastrado com consentimento registrado.`);
    setNome("");
    setWhatsapp("");
    setEmail("");
    setCirculo("frio");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Nome</label>
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">WhatsApp</label>
          <input
            required
            placeholder="+55819..."
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">E-mail (opcional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Bairro/território</label>
          <select
            value={territorioId}
            onChange={(e) => setTerritorioId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">não informado</option>
            {territorios.map((t) => (
              <option key={t.id} value={t.id}>
                {labelTerritorio(t.nome_bairro, t.cidade)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Temperatura do voto</label>
          <select
            value={circulo}
            onChange={(e) => setCirculo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="frio">Frio</option>
            <option value="morno">Morno</option>
            <option value="quente">Quente (apoiador)</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Liderança que trouxe o formulário (obrigatório)
        </label>
        <select
          required
          value={liderancaId}
          onChange={(e) => setLiderancaId(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">selecione…</option>
          {liderancas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Texto de consentimento (como no formulário assinado)
        </label>
        <textarea
          required
          rows={2}
          value={textoConsentimento}
          onChange={(e) => setTextoConsentimento(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {carregando ? "Cadastrando…" : "Cadastrar eleitor"}
      </button>
    </form>
  );
}
