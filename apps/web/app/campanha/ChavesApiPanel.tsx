"use client";

import { useState } from "react";

type ChaveStatus = {
  provedor: string;
  configurada: boolean;
  auxiliar: string | null;
};

type ProvedorConfig = {
  id: string;
  nome: string;
  grupo: string;
  descricao: string;
  instrucao: string;
  temAuxiliar: boolean;
  auxiliarLabel?: string;
  auxiliarInstrucao?: string;
};

const PROVEDORES: ProvedorConfig[] = [
  {
    id: "anthropic",
    nome: "Anthropic (Claude)",
    grupo: "Inteligência Artificial",
    descricao: "Briefing, sugestões de conteúdo, análise e copywriting via Claude.",
    instrucao: "Obtenha em console.anthropic.com > API Keys",
    temAuxiliar: false,
  },
  {
    id: "openai",
    nome: "OpenAI (GPT)",
    grupo: "Inteligência Artificial",
    descricao: "Alternativa ao Claude — usa GPT-4.1 para todas as funções de IA.",
    instrucao: "Obtenha em platform.openai.com > API Keys",
    temAuxiliar: false,
  },
  {
    id: "google_gemini",
    nome: "Google Gemini",
    grupo: "Inteligência Artificial",
    descricao: "Alternativa via Gemini 2.5 Flash — mais econômica.",
    instrucao: "Obtenha em aistudio.google.com > API Keys",
    temAuxiliar: false,
  },
  {
    id: "xai_grok",
    nome: "xAI (Grok)",
    grupo: "Inteligência Artificial",
    descricao: "Alternativa via Grok-3 da xAI.",
    instrucao: "Obtenha em console.x.ai > API Keys",
    temAuxiliar: false,
  },
  {
    id: "google_cse",
    nome: "Google Custom Search",
    grupo: "Monitoramento",
    descricao: "Busca automática de menções na internet.",
    instrucao: "Obtenha em console.cloud.google.com > APIs > Custom Search JSON API",
    temAuxiliar: true,
    auxiliarLabel: "Search Engine ID (cx)",
    auxiliarInstrucao: "Obtenha em programmablesearchengine.google.com",
  },
  {
    id: "meta_ad_library",
    nome: "Meta Ad Library API",
    grupo: "Monitoramento",
    descricao: "Monitoramento de anúncios de adversários no Facebook/Instagram.",
    instrucao: "Obtenha em developers.facebook.com > Marketing API > Ad Library",
    temAuxiliar: true,
    auxiliarLabel: "App ID",
    auxiliarInstrucao: "ID do app Meta criado em developers.facebook.com",
  },
  {
    id: "whatsapp_campanha",
    nome: "WhatsApp da Campanha",
    grupo: "WhatsApp",
    descricao: "API oficial para envio de mensagens da campanha (WhatsApp Business ou integrador).",
    instrucao: "Token da API WhatsApp Business, Z-API, Evolution ou Twilio",
    temAuxiliar: true,
    auxiliarLabel: "ID da instância / número",
    auxiliarInstrucao: "Identificador da instância ou número do WhatsApp",
  },
  {
    id: "whatsapp_denuncias",
    nome: "WhatsApp Denúncias",
    grupo: "WhatsApp",
    descricao: "Canal para militância enviar prints de conteúdos circulando nas redes.",
    instrucao: "Token da API WhatsApp Business, Z-API, Evolution ou Twilio (número separado)",
    temAuxiliar: true,
    auxiliarLabel: "ID da instância / número",
    auxiliarInstrucao: "Identificador da instância ou número do canal de denúncias",
  },
];

export function ChavesApiPanel({ chavesIniciais }: { chavesIniciais: ChaveStatus[] }) {
  const [chaves, setChaves] = useState(chavesIniciais);
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [auxiliar, setAuxiliar] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function salvar(provedor: string) {
    if (!valor.trim()) return;
    setSalvando(true);
    setErro(null);

    const res = await fetch("/api/chaves", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provedor, chave: valor.trim(), auxiliar: auxiliar.trim() || undefined }),
    });

    setSalvando(false);
    if (!res.ok) {
      const data = await res.json();
      setErro(data.error ?? "Erro ao salvar");
      return;
    }

    setChaves(chaves.map((c) =>
      c.provedor === provedor
        ? { ...c, configurada: true, auxiliar: auxiliar.trim() || null }
        : c
    ));
    setEditando(null);
    setValor("");
    setAuxiliar("");
    setSucesso(`Chave ${provedor} salva.`);
    setTimeout(() => setSucesso(null), 3000);
  }

  async function remover(provedor: string) {
    setSalvando(true);
    setErro(null);

    const res = await fetch("/api/chaves", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provedor }),
    });

    setSalvando(false);
    if (!res.ok) {
      const data = await res.json();
      setErro(data.error ?? "Erro ao remover");
      return;
    }

    setChaves(chaves.map((c) =>
      c.provedor === provedor ? { ...c, configurada: false, auxiliar: null } : c
    ));
    setSucesso(`Chave ${provedor} removida.`);
    setTimeout(() => setSucesso(null), 3000);
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Chaves de API
        </h2>
        <p className="text-sm text-neutral-400">
          Cada campanha usa suas próprias chaves. As chaves são armazenadas de forma cifrada.
        </p>
      </div>

      {sucesso && (
        <p className="rounded bg-green-50 px-3 py-2 text-xs text-green-700">{sucesso}</p>
      )}
      {erro && (
        <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-600">{erro}</p>
      )}

      <div className="space-y-4">
        {Array.from(new Set(PROVEDORES.map((p) => p.grupo))).map((grupo) => (
          <div key={grupo} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {grupo}
            </p>
            {grupo === "Inteligência Artificial" && (
              <p className="text-xs text-neutral-400 -mt-1">
                Configure ao menos uma. O sistema usa a primeira disponível: Anthropic, OpenAI ou Gemini.
              </p>
            )}
        {PROVEDORES.filter((p) => p.grupo === grupo).map((p) => {
          const status = chaves.find((c) => c.provedor === p.id);
          const configurada = status?.configurada ?? false;
          const isEditando = editando === p.id;

          return (
            <div key={p.id} className="rounded border border-neutral-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.nome}</p>
                  <p className="text-xs text-neutral-400">{p.descricao}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      configurada
                        ? "bg-green-100 text-green-700"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        configurada ? "bg-green-500" : "bg-neutral-300"
                      }`}
                    />
                    {configurada ? "Configurada" : "Não configurada"}
                  </span>
                </div>
              </div>

              {!isEditando && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditando(p.id); setValor(""); setAuxiliar(""); setErro(null); }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {configurada ? "Substituir chave" : "Configurar"}
                  </button>
                  {configurada && (
                    <button
                      type="button"
                      onClick={() => remover(p.id)}
                      disabled={salvando}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remover
                    </button>
                  )}
                </div>
              )}

              {isEditando && (
                <div className="space-y-2 border-t border-neutral-100 pt-2">
                  <p className="text-xs text-neutral-400">{p.instrucao}</p>
                  <input
                    type="password"
                    placeholder="Cole a chave aqui"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs font-mono"
                    autoComplete="off"
                  />
                  {p.temAuxiliar && (
                    <>
                      <p className="text-xs text-neutral-400">{p.auxiliarInstrucao}</p>
                      <input
                        type="text"
                        placeholder={p.auxiliarLabel}
                        value={auxiliar}
                        onChange={(e) => setAuxiliar(e.target.value)}
                        className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs font-mono"
                        autoComplete="off"
                      />
                    </>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => salvar(p.id)}
                      disabled={salvando || !valor.trim()}
                      className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {salvando ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditando(null); setErro(null); }}
                      className="rounded bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {configurada && status?.auxiliar && (
                <p className="text-xs text-neutral-400">
                  ID auxiliar: {status.auxiliar}
                </p>
              )}
            </div>
          );
        })}
          </div>
        ))}
      </div>
    </section>
  );
}
