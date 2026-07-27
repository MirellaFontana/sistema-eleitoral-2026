import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterChaveApi } from "@/lib/chaves-api";
import { criarClienteIA } from "@/lib/ia-client";
import { SISTEMA_REVISOR_COMPLIANCE } from "@/lib/anthropic";
import { GoogleGenAI } from "@google/genai";

const PAPEIS_QUE_REVISAM = new Set([
  "coord_campanha",
  "coord_marketing",
  "redator_marketing",
  "advogado_responsavel",
  "assistente_juridico",
]);

function parseJsonSeguro(raw: string): Record<string, unknown> | null {
  let limpo = raw.replace(/```(?:json)?/gi, "").trim();
  const inicio = limpo.indexOf("{");
  if (inicio === -1) return null;
  limpo = limpo.slice(inicio);

  try {
    return JSON.parse(limpo);
  } catch {}

  let profundidade = 0;
  let dentroDeString = false;
  let escape = false;
  let fim = -1;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      dentroDeString = !dentroDeString;
      continue;
    }
    if (dentroDeString) continue;
    if (c === "{") profundidade++;
    else if (c === "}") {
      profundidade--;
      if (profundidade === 0) {
        fim = i;
        break;
      }
    }
  }
  if (fim === -1) return null;
  try {
    return JSON.parse(limpo.slice(0, fim + 1));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { peca_id } = body as { peca_id: string };

  if (!peca_id) {
    return NextResponse.json({ error: "peca_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select(
      "papel, campanha_id, campanhas(nome_candidato, cargo, uf, partido, numero_candidato, nome_urna, cnpj_campanha, coligacao)",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_REVISAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const { data: peca, error: errPeca } = await supabase
    .from("pecas_conteudo")
    .select("id, tipo, canal, conteudo, arte_path, arte_mime, usou_ia, ferramenta")
    .eq("id", peca_id)
    .maybeSingle();

  if (errPeca || !peca) {
    return NextResponse.json({ error: "peça não encontrada" }, { status: 404 });
  }

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;
  const identidade = campanha
    ? [
        `Candidato: ${campanha.nome_candidato ?? "–"}`,
        `Nome de urna: ${campanha.nome_urna ?? "–"}`,
        `Número do candidato: ${campanha.numero_candidato ?? "–"}`,
        `Cargo: ${campanha.cargo ?? "–"} – ${campanha.uf ?? "–"}`,
        `Partido: ${campanha.partido ?? "–"}`,
        `Coligação: ${campanha.coligacao ?? "–"}`,
        `CNPJ da campanha: ${campanha.cnpj_campanha ?? "–"}`,
      ].join("\n")
    : "(identidade da campanha não cadastrada)";

  const contextoTexto = [
    `IDENTIDADE DA CAMPANHA (referência do que deve aparecer NA PEÇA):\n${identidade}`,
    `TIPO DA PEÇA: ${peca.tipo}`,
    `CANAL: ${peca.canal}`,
    `PEÇA GERADA POR IA: ${peca.usou_ia ? "SIM" : "não"}${peca.ferramenta ? ` (${peca.ferramenta})` : ""}`,
    peca.conteudo ? `TEXTO/LEGENDA DA PEÇA:\n${peca.conteudo}` : "TEXTO/LEGENDA DA PEÇA: (sem texto)",
    peca.arte_path ? "A imagem da peça está anexada." : "A peça não tem imagem — só texto.",
  ].join("\n\n");

  let respostaRaw: string;

  // Se tem imagem, usa Gemini vision (única do stack atual com suporte multimodal simples).
  if (peca.arte_path) {
    const chaveGemini =
      (await obterChaveApi(supabase, "google_gemini")) ?? process.env.GEMINI_API_KEY ?? null;
    if (!chaveGemini) {
      return NextResponse.json(
        {
          error:
            "Peças com imagem exigem chave Gemini configurada (Cadastro de Campanha > Chaves de API ou GEMINI_API_KEY).",
        },
        { status: 400 },
      );
    }

    const { data: signedData } = await supabase.storage
      .from("pecas-arte")
      .createSignedUrl(peca.arte_path, 60);
    if (!signedData?.signedUrl) {
      return NextResponse.json({ error: "não consegui acessar a imagem da peça" }, { status: 500 });
    }

    let imagemBase64: string;
    let mime: string;
    try {
      const imgRes = await fetch(signedData.signedUrl);
      const buf = await imgRes.arrayBuffer();
      imagemBase64 = Buffer.from(buf).toString("base64");
      mime = imgRes.headers.get("content-type") ?? peca.arte_mime ?? "image/png";
    } catch (err) {
      const m = err instanceof Error ? err.message : "erro";
      return NextResponse.json({ error: `falha ao baixar imagem: ${m}` }, { status: 500 });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: chaveGemini });
      const resp = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          {
            role: "user",
            parts: [
              { text: `${SISTEMA_REVISOR_COMPLIANCE}\n\n${contextoTexto}` },
              { inlineData: { mimeType: mime, data: imagemBase64 } },
            ],
          },
        ],
      });
      respostaRaw = resp.text?.trim() ?? "";
    } catch (err) {
      const m = err instanceof Error ? err.message : "erro na chamada Gemini";
      return NextResponse.json({ error: `falha ao revisar imagem: ${m}` }, { status: 502 });
    }
  } else {
    // Só texto — usa o cliente IA abstrato (Anthropic → OpenAI → Gemini → Grok).
    const ia = await criarClienteIA(supabase);
    if (!ia) {
      return NextResponse.json(
        { error: "Nenhuma chave de IA configurada." },
        { status: 400 },
      );
    }
    try {
      respostaRaw = await ia.gerar({
        sistema: SISTEMA_REVISOR_COMPLIANCE,
        mensagens: [{ role: "user", content: contextoTexto }],
        maxTokens: 1200,
        jsonMode: true,
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : "erro na IA";
      return NextResponse.json({ error: `falha ao revisar peça: ${m}` }, { status: 502 });
    }
  }

  const parsed = parseJsonSeguro(respostaRaw);
  if (!parsed) {
    return NextResponse.json(
      { error: "modelo retornou formato inesperado. Tente novamente." },
      { status: 502 },
    );
  }

  const { error: errUpdate } = await supabase
    .from("pecas_conteudo")
    .update({
      revisao_ia_json: parsed,
      revisao_ia_em: new Date().toISOString(),
    })
    .eq("id", peca_id);

  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, revisao: parsed });
}
