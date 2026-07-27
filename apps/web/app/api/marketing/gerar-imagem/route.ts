import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterChaveApi } from "@/lib/chaves-api";
import { GoogleGenAI, Modality } from "@google/genai";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

export async function POST(request: Request) {
  const body = await request.json();
  const { prompt, formato } = body as { prompt: string; formato?: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt é obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const chaveGemini =
    (await obterChaveApi(supabase, "google_gemini")) ?? process.env.GEMINI_API_KEY ?? null;
  if (!chaveGemini) {
    return NextResponse.json(
      { error: "Chave Gemini não configurada. Vá em Cadastro de Campanha > Chaves de API." },
      { status: 400 },
    );
  }

  const orientacao =
    formato === "stories"
      ? "vertical 9:16"
      : formato === "post_instagram" || formato === "whatsapp"
        ? "quadrada 1:1"
        : formato === "facebook" || formato === "twitter"
          ? "horizontal 16:9"
          : "quadrada 1:1";

  const promptFinal = `${prompt.trim()}

REGRAS TÉCNICAS OBRIGATÓRIAS:
- Orientação: ${orientacao}.
- NUNCA inclua texto, letras, números ou símbolos legíveis na imagem — o overlay legal
  (número do candidato, nome de urna, CNPJ, coligação, selo IA) é adicionado depois pela equipe.
- NUNCA inclua rostos identificáveis (foto do candidato entra por cima manualmente).
- NUNCA inclua bandeiras partidárias, símbolos eleitorais oficiais ou logos reconhecíveis.
- Composição limpa, com respiro lateral e inferior para overlay.
- Estilo fotorrealista, iluminação natural, ambientação brasileira coerente com o tema.`;

  try {
    const ai = new GoogleGenAI({ apiKey: chaveGemini });
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: promptFinal,
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });

    const parts = resp.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
      if (inline?.data) {
        const png = Buffer.from(inline.data, "base64");
        return new NextResponse(png, {
          headers: {
            "Content-Type": inline.mimeType ?? "image/png",
            "Content-Disposition": `inline; filename="imagem-${Date.now()}.png"`,
          },
        });
      }
    }

    const textoRetornado = resp.text ?? "sem detalhe";
    return NextResponse.json(
      { error: `Gemini não retornou imagem. Detalhe: ${textoRetornado.slice(0, 300)}` },
      { status: 502 },
    );
  } catch (err) {
    const m = err instanceof Error ? err.message : "erro na chamada Gemini";
    return NextResponse.json({ error: `falha ao gerar imagem: ${m}` }, { status: 502 });
  }
}
