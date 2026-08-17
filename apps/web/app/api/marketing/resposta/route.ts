import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizarTexto, sanitizarTextoOpcional } from "@/lib/sanitizar";
import { SISTEMA_RESPOSTA_REDES } from "@/lib/anthropic";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { carregarContexto } from "@/lib/contexto-campanha";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

export async function POST(request: Request) {
  const body = await request.json();
  const { pergunta, categoria, canal_origem, contexto_adicional } = body as {
    pergunta: string;
    categoria?: string;
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
  const limited = checkRateLimit(user.id);
  if (limited) return limited;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(voz_candidato)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "seu papel não gera resposta sugerida" }, { status: 403 });
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json(
      { error: "Nenhuma chave de IA configurada. Vá em Cadastro de Campanha > Chaves de API." },
      { status: 400 }
    );
  }

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;
  const ctx = await carregarContexto(supabase, eu.campanha_id, ["voz", "diretrizes", "temas"], campanha);

  const mensagem = [
    ctx.diretrizes || null,
    ctx.voz ? `VOZ DO CANDIDATO (copie expressões, ritmo, jeito de falar):\n${ctx.voz}` : null,
    `Canal: ${canal_origem}\n\nPergunta recebida:\n${pergunta}`,
    ctx.temas ? `Conhecimento da campanha disponível:\n${ctx.temas.slice(0, 12000)}` : "(nenhum item de base de conhecimento cadastrado ainda)",
    contexto_adicional?.trim() ? `Contexto adicional fornecido:\n${contexto_adicional}` : null,
  ].filter(Boolean).join("\n\n");

  let respostaSugerida: string;
  try {
    respostaSugerida = await ia.gerar({
      sistema: SISTEMA_RESPOSTA_REDES,
      mensagens: [{ role: "user", content: mensagem }],
      maxTokens: 1000,
    });
  } catch (err) {
    return respostaErroIA(err);
  }

  const { data: row, error } = await supabase
    .from("respostas_redes_sociais")
    .insert({
      campanha_id: eu.campanha_id,
      pergunta: sanitizarTexto(pergunta, 2000),
      categoria: sanitizarTexto(categoria ?? "geral", 100),
      canal_origem: sanitizarTexto(canal_origem, 100),
      contexto_adicional: sanitizarTextoOpcional(contexto_adicional, 2000),
      modelo_ia: ia.provedor,
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
