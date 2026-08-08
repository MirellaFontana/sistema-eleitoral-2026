import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verificarCronAuth } from "@/lib/cron-auth";
import { GoogleGenAI } from "@google/genai";

function extrairTextoLegivel(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30_000);
}

async function resumirAlteracoes(
  titulo: string,
  textoAnterior: string,
  textoAtual: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Você é um jurista brasileiro especialista em direito eleitoral.

Abaixo está o texto ANTERIOR e o texto ATUAL de uma fonte normativa. Identifique as alterações relevantes.

FONTE: ${titulo}

TEXTO ANTERIOR (trecho):
${textoAnterior.slice(0, 12_000)}

TEXTO ATUAL (trecho):
${textoAtual.slice(0, 12_000)}

Responda em português, de forma objetiva, listando APENAS as alterações encontradas:
- Artigos/dispositivos adicionados
- Artigos/dispositivos alterados (cite o artigo e o que mudou)
- Artigos/dispositivos revogados
- Mudanças de redação relevantes

Se as diferenças forem apenas de formatação HTML ou espaçamento (sem mudança de conteúdo legal), responda: "Sem alterações de conteúdo — apenas formatação."

Máximo 500 palavras.`;

  try {
    const resp = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: { maxOutputTokens: 1500 },
    });
    return resp.text?.trim() || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const authErr = verificarCronAuth(request);
  if (authErr) return authErr;

  const supabase = createServiceClient();

  const { data: fontes } = await supabase
    .from("fontes_normativas")
    .select("id, url_oficial, hash_conteudo, titulo, status")
    .not("url_oficial", "is", null)
    .in("status", ["validada", "pendente"]);

  if (!fontes || fontes.length === 0) {
    return NextResponse.json({ message: "nenhuma fonte normativa com URL para verificar" });
  }

  const resultados: { id: string; titulo: string; mudou: boolean; resumo?: string; erro?: string }[] = [];

  for (const f of fontes) {
    try {
      const res = await fetch(f.url_oficial!, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        resultados.push({ id: f.id, titulo: f.titulo, mudou: false, erro: `HTTP ${res.status}` });
        continue;
      }

      const html = await res.text();
      const encoder = new TextEncoder();
      const data = encoder.encode(html);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const novoHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const mudou = f.hash_conteudo !== null && f.hash_conteudo !== novoHash;

      const updates: Record<string, unknown> = {
        data_verificacao: new Date().toISOString().slice(0, 10),
        hash_conteudo: novoHash,
        updated_at: new Date().toISOString(),
      };

      if (mudou) {
        updates.status = "desatualizada";

        const textoAtual = extrairTextoLegivel(html);

        let textoAnterior = "";
        try {
          const resAnterior = await fetch(f.url_oficial!, {
            signal: AbortSignal.timeout(15_000),
            cache: "force-cache",
          });
          if (resAnterior.ok) {
            textoAnterior = extrairTextoLegivel(await resAnterior.text());
          }
        } catch {
          // fallback: sem texto anterior, usa string vazia
        }

        const resumo = await resumirAlteracoes(
          f.titulo,
          textoAnterior || "(texto anterior não disponível — primeira verificação ou cache expirado)",
          textoAtual,
        );

        if (resumo) {
          updates.alteracoes_resumo = resumo;
        }

        resultados.push({ id: f.id, titulo: f.titulo, mudou: true, resumo: resumo ?? undefined });
      } else {
        resultados.push({ id: f.id, titulo: f.titulo, mudou: false });
      }

      await supabase
        .from("fontes_normativas")
        .update(updates)
        .eq("id", f.id);
    } catch (e) {
      resultados.push({ id: f.id, titulo: f.titulo, mudou: false, erro: String(e) });
    }
  }

  const alteradas = resultados.filter((r) => r.mudou).length;
  return NextResponse.json({ verificadas: resultados.length, alteradas, resultados });
}
