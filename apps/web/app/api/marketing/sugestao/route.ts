import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient, MODELO_IA, SISTEMA_SUGESTAO_CONTEUDO } from "@/lib/anthropic";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

export async function POST(request: Request) {
  const body = await request.json();
  const { formato, contexto_usado } = body as { formato: string; contexto_usado: string };

  if (!formato || !contexto_usado?.trim()) {
    return NextResponse.json({ error: "formato e contexto_usado são obrigatórios" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "seu papel não gera sugestão de conteúdo" }, { status: 403 });
  }

  const anthropic = createAnthropicClient();
  if (!anthropic) {
    return NextResponse.json(
      { error: "API key da Anthropic ainda não configurada — peça pro administrador configurar ANTHROPIC_API_KEY." },
      { status: 400 }
    );
  }

  const msg = await anthropic.messages.create({
    model: MODELO_IA,
    max_tokens: 1200,
    system: SISTEMA_SUGESTAO_CONTEUDO,
    messages: [
      {
        role: "user",
        content: `Formato pedido: ${formato}\n\nBase/contexto fornecido pela campanha:\n${contexto_usado}`,
      },
    ],
  });

  const sugestao = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();

  const { data: row, error } = await supabase
    .from("sugestoes_conteudo")
    .insert({
      campanha_id: eu.campanha_id,
      formato,
      contexto_usado,
      modelo_ia: MODELO_IA,
      sugestao,
    })
    .select("id, sugestao, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
