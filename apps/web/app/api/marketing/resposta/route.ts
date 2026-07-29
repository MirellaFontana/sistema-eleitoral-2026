import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTexto, sanitizarTextoOpcional } from "@/lib/sanitizar";
import {
  SISTEMA_RESPOSTA_REDES,
  montarContextoConhecimento,
  type TemaComItens,
} from "@/lib/anthropic";
import { criarClienteIA } from "@/lib/ia-client";
import { obterContextoDiretrizes } from "@/lib/diretrizes-context";

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

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json(
      { error: "Nenhuma chave de IA configurada. Vá em Cadastro de Campanha > Chaves de API." },
      { status: 400 }
    );
  }

  const { data: temasDb } = await supabase
    .from("temas_campanha")
    .select("id, nome, publicos_alvo, regioes_prioritarias, base_conhecimento_itens(titulo, descricao)")
    .order("ordem");

  const temasCtx: TemaComItens[] = (temasDb ?? []).map((t) => ({
    nome: t.nome,
    publicos_alvo: t.publicos_alvo ?? [],
    regioes_prioritarias: t.regioes_prioritarias ?? [],
    itens: (Array.isArray(t.base_conhecimento_itens) ? t.base_conhecimento_itens : []) as { titulo: string; descricao: string | null }[],
  }));

  const conhecimento = montarContextoConhecimento(temasCtx).slice(0, 12000);
  const diretrizes = await obterContextoDiretrizes(supabase, eu.campanha_id);

  let respostaSugerida: string;
  try {
    respostaSugerida = await ia.gerar({
      sistema: SISTEMA_RESPOSTA_REDES,
      mensagens: [
        {
          role: "user",
          content: [
            diretrizes || null,
            `Canal: ${canal_origem}\n\nPergunta recebida:\n${pergunta}`,
            `Conhecimento da campanha disponível:\n${conhecimento || "(nenhum item de base de conhecimento cadastrado ainda)"}`,
            contexto_adicional?.trim() ? `Contexto adicional fornecido:\n${contexto_adicional}` : null,
          ].filter(Boolean).join("\n\n"),
        },
      ],
      maxTokens: 1000,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido ao chamar IA";
    return NextResponse.json({ error: `Falha ao gerar resposta: ${mensagem}` }, { status: 502 });
  }

  const { data: row, error } = await supabase
    .from("respostas_redes_sociais")
    .insert({
      campanha_id: eu.campanha_id,
      pergunta: sanitizarTexto(pergunta, 2000),
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
