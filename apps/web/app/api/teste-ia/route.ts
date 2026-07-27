import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY não configurada no .env.local" },
      { status: 400 },
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const resp = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [{ text: "Responda apenas: 'Gemini funcionando!' — nada mais." }],
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      provedor: "google_gemini",
      modelo: "gemini-flash-latest",
      resposta: resp.text?.trim() ?? "(vazio)",
      prefixo_chave: apiKey.slice(0, 4) + "...",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, provedor: "google_gemini", error: msg },
      { status: 502 },
    );
  }
}
