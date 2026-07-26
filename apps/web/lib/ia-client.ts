import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { type SupabaseClient } from "@supabase/supabase-js";
import { obterChaveApi } from "./chaves-api";

export type ProvedorIA = "anthropic" | "openai" | "google_gemini" | "xai_grok";

type MensagemIA = { role: "user" | "assistant"; content: string };

export type ClienteIA = {
  provedor: ProvedorIA;
  gerar: (opts: {
    sistema: string;
    mensagens: MensagemIA[];
    maxTokens?: number;
  }) => Promise<string>;
};

const MODELOS: Record<ProvedorIA, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4.1",
  google_gemini: "gemini-2.5-flash",
  xai_grok: "grok-3",
};

function criarClienteAnthropic(apiKey: string): ClienteIA {
  const client = new Anthropic({ apiKey });
  return {
    provedor: "anthropic",
    async gerar({ sistema, mensagens, maxTokens = 2000 }) {
      const msg = await client.messages.create({
        model: MODELOS.anthropic,
        max_tokens: maxTokens,
        system: sistema,
        messages: mensagens.map((m) => ({ role: m.role, content: m.content })),
      });
      return msg.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim();
    },
  };
}

function criarClienteOpenAI(apiKey: string): ClienteIA {
  const client = new OpenAI({ apiKey });
  return {
    provedor: "openai",
    async gerar({ sistema, mensagens, maxTokens = 2000 }) {
      const resp = await client.chat.completions.create({
        model: MODELOS.openai,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: sistema },
          ...mensagens.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
      });
      return resp.choices[0]?.message?.content?.trim() ?? "";
    },
  };
}

function criarClienteGemini(apiKey: string): ClienteIA {
  const ai = new GoogleGenAI({ apiKey });
  return {
    provedor: "google_gemini",
    async gerar({ sistema, mensagens, maxTokens = 2000 }) {
      const resp = await ai.models.generateContent({
        model: MODELOS.google_gemini,
        config: {
          maxOutputTokens: maxTokens,
          systemInstruction: sistema,
        },
        contents: mensagens.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      });
      return resp.text?.trim() ?? "";
    },
  };
}

function criarClienteGrok(apiKey: string): ClienteIA {
  const client = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
  return {
    provedor: "xai_grok",
    async gerar({ sistema, mensagens, maxTokens = 2000 }) {
      const resp = await client.chat.completions.create({
        model: MODELOS.xai_grok,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: sistema },
          ...mensagens.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
      });
      return resp.choices[0]?.message?.content?.trim() ?? "";
    },
  };
}

const ORDEM_PROVEDORES: ProvedorIA[] = ["anthropic", "openai", "google_gemini", "xai_grok"];

const FABRICAS: Record<ProvedorIA, (key: string) => ClienteIA> = {
  anthropic: criarClienteAnthropic,
  openai: criarClienteOpenAI,
  google_gemini: criarClienteGemini,
  xai_grok: criarClienteGrok,
};

function isErroDeAcesso(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("permission") ||
    msg.includes("denied") ||
    msg.includes("disabled") ||
    msg.includes("unauthorized") ||
    msg.includes("invalid") ||
    msg.includes("403") ||
    msg.includes("401") ||
    msg.includes("quota")
  );
}

type ClienteIAComFallback = ClienteIA & {
  _provedoresDisponiveis: { provedor: ProvedorIA; chave: string }[];
};

export async function criarClienteIA(supabase: SupabaseClient): Promise<ClienteIA | null> {
  const disponiveis: { provedor: ProvedorIA; chave: string }[] = [];

  for (const provedor of ORDEM_PROVEDORES) {
    const chave = await obterChaveApi(supabase, provedor);
    if (chave) disponiveis.push({ provedor, chave });
  }

  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) disponiveis.push({ provedor: "anthropic", chave: envKey });

  if (disponiveis.length === 0) return null;

  const primeiro = disponiveis[0];
  const clienteBase = FABRICAS[primeiro.provedor](primeiro.chave);

  if (disponiveis.length === 1) return clienteBase;

  const cliente: ClienteIAComFallback = {
    provedor: primeiro.provedor,
    _provedoresDisponiveis: disponiveis,
    async gerar(opts) {
      for (let i = 0; i < disponiveis.length; i++) {
        const { provedor, chave } = disponiveis[i];
        const c = FABRICAS[provedor](chave);
        try {
          const resultado = await c.gerar(opts);
          cliente.provedor = provedor;
          return resultado;
        } catch (err) {
          const ultimo = i === disponiveis.length - 1;
          if (ultimo || !isErroDeAcesso(err)) throw err;
        }
      }
      throw new Error("Todos os provedores de IA falharam");
    },
  };

  return cliente;
}

export { MODELOS as MODELOS_IA };
