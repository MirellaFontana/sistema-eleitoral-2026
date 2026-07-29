import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarClienteIA } from "@/lib/ia-client";
import { parseJsonSeguro } from "@/lib/parse-json-seguro";

const SISTEMA = `Você é um consultor político experiente ajudando a configurar as diretrizes de campanha de um candidato.
Com base nas informações fornecidas, gere um rascunho completo das diretrizes.

Responda em JSON com esta estrutura:
{
  "identidade": "Biografia e trajetória do candidato em 2-3 parágrafos",
  "valores": "Valores, causas e compromissos fundamentais",
  "vocabulario_preferido": ["lista de 8-12 termos que o candidato deve usar"],
  "vocabulario_proibido": ["lista de 5-8 termos que nunca devem ser usados"],
  "assuntos_sensiveis": ["lista de 3-5 temas que exigem cuidado"],
  "limites": "O que nunca fazer ou dizer na campanha",
  "mensagens_mae": [
    {"tema": "nome do tema", "mensagem": "frase-chave do candidato", "adaptacoes": "como adaptar por contexto"}
  ],
  "posicoes_sugeridas": [
    {"tema": "nome do tema", "posicao": "posição do candidato", "evidencias": "provas ou argumentos"}
  ]
}

Gere conteúdo realista, profissional e adaptado ao contexto político brasileiro.
Inclua 3-5 mensagens-mãe e 5-8 posições por tema.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu || !["coord_campanha", "candidato"].includes(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const { nome, cargo, partido, cidade, biografia, temas_prioritarios } = body;

  if (!nome || !cargo) {
    return NextResponse.json({ error: "nome e cargo são obrigatórios" }, { status: 400 });
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) return NextResponse.json({ error: "nenhum provedor de IA configurado" }, { status: 500 });

  const prompt = [
    `CANDIDATO: ${nome}`,
    `CARGO PRETENDIDO: ${cargo}`,
    partido ? `PARTIDO: ${partido}` : null,
    cidade ? `CIDADE/REGIÃO: ${cidade}` : null,
    biografia ? `BIOGRAFIA:\n${biografia}` : null,
    temas_prioritarios ? `TEMAS PRIORITÁRIOS: ${temas_prioritarios}` : null,
    "",
    "Gere as diretrizes de campanha completas em JSON.",
  ].filter(Boolean).join("\n");

  try {
    const raw = await ia.gerar({
      sistema: SISTEMA,
      mensagens: [{ role: "user", content: prompt }],
      maxTokens: 4000,
      jsonMode: true,
    });

    const parsed = parseJsonSeguro(raw);
    if (!parsed) return NextResponse.json({ error: "falha ao interpretar resposta da IA" }, { status: 500 });

    return NextResponse.json({ rascunho: parsed, provedor: ia.provedor });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
