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
  const [cidade, setCidade] = useState("");
  const [liderancaId, setLiderancaId] = useState("");
  const [territorioId, setTerritorioId] = useState("");
  const [circulo, setCirculo] = useState("frio");
  const [textoConsentimento, setTextoConsentimento] = useState(TEXTO_CONSENTIMENTO_PADRAO);
  const [aceitaLgpd, setAceitaLgpd] = useState(false);
  const [aceitaComunicacao, setAceitaComunicacao] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function capturarGps() {
    if (!navigator.geolocation) {
      setGpsStatus("Geolocalização não suportada neste navegador.");
      return;
    }
    setGpsStatus("Obtendo localização…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsStatus(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      (err) => {
        setGpsStatus(
          err.code === 1
            ? "Permissão de localização negada."
            : "Não foi possível obter a localização."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    if (!aceitaLgpd) {
      setErro("O consentimento para tratamento de dados é obrigatório.");
      setCarregando(false);
      return;
    }

    const row: Record<string, unknown> = {
      campanha_id: campanhaId,
      nome: nome.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim() || null,
      cidade: cidade.trim() || null,
      circulo,
      territorio_id: territorioId || null,
      origem_cadastro: liderancaId ? "formulario_lideranca" : "iniciativa_propria",
      lideranca_id: liderancaId || null,
      aceita_comunicacao: aceitaComunicacao,
    };
    if (lat != null && lng != null) {
      row.geom = `POINT(${lng} ${lat})`;
    }

    const { data: cidadao, error } = await supabase
      .from("cidadaos")
      .insert(row)
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
    setTimeout(() => setSucesso(null), 3000);
    setNome("");
    setWhatsapp("");
    setEmail("");
    setCidade("");
    setCirculo("frio");
    setAceitaLgpd(false);
    setAceitaComunicacao(false);
    setLat(null);
    setLng(null);
    setGpsStatus(null);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <label className="block text-xs font-medium text-neutral-500">Cidade</label>
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex.: Recife"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
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
            <option value="quente">Quente</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Bairro/território{" "}
          <span className="font-normal text-neutral-400">
            (opcional — usado no mapa de cobertura)
          </span>
        </label>
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
        <label className="block text-xs font-medium text-neutral-500">
          Liderança que trouxe o formulário{" "}
          <span className="font-normal text-neutral-400">(opcional)</span>
        </label>
        <select
          value={liderancaId}
          onChange={(e) => setLiderancaId(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">Nenhuma — cadastro por iniciativa própria</option>
          {liderancas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Localização GPS{" "}
          <span className="font-normal text-neutral-400">
            (opcional — marca onde o formulário foi preenchido)
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={capturarGps}
            className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
          >
            📍 Capturar GPS
          </button>
          {gpsStatus && (
            <span className="text-xs text-neutral-500">{gpsStatus}</span>
          )}
          {lat != null && (
            <button
              type="button"
              onClick={() => { setLat(null); setLng(null); setGpsStatus(null); }}
              className="text-xs text-red-500 hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Consentimento</p>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={aceitaLgpd}
            onChange={(e) => setAceitaLgpd(e.target.checked)}
            className="mt-0.5 rounded border-neutral-300"
          />
          <span className="text-neutral-700">
            <strong className="text-red-600">*</strong> Autorizo o tratamento dos meus dados pessoais pela campanha para fins de comunicação eleitoral, conforme a Lei Geral de Proteção de Dados (LGPD). Estou ciente de que posso revogar este consentimento a qualquer momento.
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={aceitaComunicacao}
            onChange={(e) => setAceitaComunicacao(e.target.checked)}
            className="mt-0.5 rounded border-neutral-300"
          />
          <span className="text-neutral-600">
            Aceito receber notícias, informações e materiais da campanha por WhatsApp, e-mail ou outros canais de comunicação.
          </span>
        </label>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Cadastrando…" : "Cadastrar eleitor"}
      </button>
    </form>
  );
}
