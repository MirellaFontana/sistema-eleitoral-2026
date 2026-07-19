import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient, MODELO_IA, SISTEMA_RESPOSTA_REDES } from "@/lib/anthropic";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

export async function POST(request: Request) {
  const body = await request.json();
  const { pergunta, canal_origem, contexto_adicional } = body as {
    pergunta: string;
    canal_origem: string;
    contexto_adicional?: string;
  };

  if (!pergunta?.trim() || !canal_origem) {
    return NextResponse.json({ error: "pergunta e canal_origem são obrigatórios" }, { status: 400 });
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
    return NextResponse.json({ error: "seu papel não gera resposta sugerida" }, { status: 403 });
  }

  const anthropic = createAnthropicClient();
  if (!anthropic) {
    return NextResponse.json(
      { error: "API key da Anthropic ainda não configurada — peça pro administrador configurar ANTHROPIC_API_KEY." },
      { status: 400 }
    );
  }

  // Conhecimento da própria sessão do usuário — a RLS de base_conhecimento_itens já garante
  // que só vem o que pertence à campanha dele, mesma consulta que /marketing já faz.
  const { data: itens } = await supabase
    .from("base_conhecimento_itens")
    .select("titulo, descricao")
    .not("descricao", "is", null)
    .order("titulo");

  const conhecimento = (itens ?? [])
    .map((i) => `- ${i.titulo}: ${i.descricao}`)
    .join("\n")
    .slice(0, 12000); // limite generoso, evita prompt gigante se a base crescer muito

  let respostaSugerida: string;
  try {
    const msg = await anthropic.messages.create({
      model: MODELO_IA,
      max_tokens: 1000,
      system: SISTEMA_RESPOSTA_REDES,
      messages: [
        {
          role: "user",
          content: `Canal: ${canal_origem}\n\nPergunta recebida:\n${pergunta}\n\nConhecimento da campanha disponível:\n${
            conhecimento || "(nenhum item de base de conhecimento cadastrado ainda)"
          }${contexto_adicional?.trim() ? `\n\nContexto adicional fornecido:\n${contexto_adicional}` : ""}`,
        },
      ],
    });
    respostaSugerida = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido ao chamar a Anthropic";
    return NextResponse.json({ error: `Falha ao gerar resposta: ${mensagem}` }, { status: 502 });
  }

  const { data: row, error } = await supabase
    .from("respostas_redes_sociais")
    .insert({
      campanha_id: eu.campanha_id,
      pergunta,
      canal_origem,
      contexto_adicional: contexto_adicional?.trim() || null,
      modelo_ia: MODELO_IA,
      resposta_sugerida: respostaSugerida,
      solicitado_por: user.id,
    })
    .select("id, resposta_sugerida, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
