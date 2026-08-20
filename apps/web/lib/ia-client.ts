import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { obterChaveApi } from "./chaves-api";

export type ProvedorIA = "anthropic" | "openai" | "openrouter" | "xai_grok";

type MensagemIA = { role: "user" | "assistant"; content: string };

export type ClienteIA = {
  provedor: ProvedorIA;
  gerar: (opts: {
    sistema: string;
    mensagens: MensagemIA[];
    maxTokens?: number;
    jsonMode?: boolean;
  }) => Promise<string>;
};

const MODELOS: Record<ProvedorIA, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4.1",
  openrouter: "deepseek/deepseek-v4-flash-latest",
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
    async gerar({ sistema, mensagens, maxTokens = 2000, jsonMode }) {
      const resp = await client.chat.completions.create({
        model: MODELOS.openai,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: "json_object" } : undefined,
        messages: [
          { role: "system", content: sistema },
          ...mensagens.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
      });
      return resp.choices[0]?.message?.content?.trim() ?? "";
    },
  };
}

function criarClienteOpenRouter(apiKey: string): ClienteIA {
  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
  return {
    provedor: "openrouter",
    async gerar({ sistema, mensagens, maxTokens = 2000, jsonMode }) {
      const resp = await client.chat.completions.create({
        model: MODELOS.openrouter,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: "json_object" } : undefined,
        messages: [
          { role: "system", content: sistema },
          ...mensagens.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
      });
      return resp.choices[0]?.message?.content?.trim() ?? "";
    },
  };
}

function criarClienteGrok(apiKey: string): ClienteIA {
  const client = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
  return {
    provedor: "xai_grok",
    async gerar({ sistema, mensagens, maxTokens = 2000, jsonMode }) {
      const resp = await client.chat.completions.create({
        model: MODELOS.xai_grok,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: "json_object" } : undefined,
        messages: [
          { role: "system", content: sistema },
          ...mensagens.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
      });
      return resp.choices[0]?.message?.content?.trim() ?? "";
    },
  };
}

const ORDEM_PROVEDORES: ProvedorIA[] = ["openrouter", "anthropic", "openai", "xai_grok"];

const FABRICAS: Record<ProvedorIA, (key: string) => ClienteIA> = {
  openrouter: criarClienteOpenRouter,
  anthropic: criarClienteAnthropic,
  openai: criarClienteOpenAI,
  xai_grok: criarClienteGrok,
};

export function isErroDeAcesso(err: unknown): boolean {
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

function isErroTransiente(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("overloaded") ||
    msg.includes("high demand") ||
    msg.includes("rate") ||
    msg.includes("unavailable") ||
    msg.includes("529") ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("too many")
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

  const envAnthropic = process.env.ANTHROPIC_API_KEY;
  if (envAnthropic) disponiveis.push({ provedor: "anthropic", chave: envAnthropic });

  const envOpenRouter = process.env.OPENROUTER_API_KEY;
  if (envOpenRouter) disponiveis.push({ provedor: "openrouter", chave: envOpenRouter });

  const envOpenAI = process.env.OPENAI_API_KEY;
  if (envOpenAI) disponiveis.push({ provedor: "openai", chave: envOpenAI });

  if (disponiveis.length === 0) return null;

  const primeiro = disponiveis[0];
  const clienteBase = FABRICAS[primeiro.provedor](primeiro.chave);

  if (disponiveis.length === 1) {
    const gerarOriginal = clienteBase.gerar.bind(clienteBase);
    clienteBase.gerar = async (opts) => {
      try {
        return await gerarOriginal(opts);
      } catch (err) {
        if (!isErroTransiente(err)) throw err;
        await new Promise((r) => setTimeout(r, 3000));
        return gerarOriginal(opts);
      }
    };
    return clienteBase;
  }

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
          if (ultimo || (!isErroDeAcesso(err) && !isErroTransiente(err))) throw err;
        }
      }
      throw new Error("Todos os provedores de IA falharam");
    },
  };

  return cliente;
}

export { MODELOS as MODELOS_IA };

export function respostaErroIA(err: unknown): NextResponse {
  const raw = err instanceof Error ? err.message : String(err);
  const sobrecarregado = /overloaded|high demand|529|503|UNAVAILABLE/i.test(raw);
  const msg = sobrecarregado
    ? "O modelo de IA está sobrecarregado no momento. Tente novamente em alguns segundos."
    : "Erro ao consultar a IA. Tente novamente.";
  return NextResponse.json({ error: msg }, { status: sobrecarregado ? 503 : 502 });
}
