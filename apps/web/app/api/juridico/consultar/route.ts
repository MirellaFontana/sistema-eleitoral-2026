import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { SISTEMA_CONSULTA_JURIDICA } from "@/lib/anthropic";
import { obterContextoDiretrizes } from "@/lib/diretrizes-context";
import { obterContextoNormativo } from "@/lib/normativa-context";

export async function POST(request: Request) {
  const { pergunta } = (await request.json()) as { pergunta?: string };
  if (!pergunta?.trim()) {
    return NextResponse.json({ error: "pergunta vazia" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const limited = checkRateLimit(user.id);
  if (limited) return limited;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem acesso" }, { status: 403 });

  const { data: itens } = await supabase
    .from("base_conhecimento_itens")
    .select("titulo, descricao, temas_campanha(nome)")
    .order("created_at", { ascending: false })
    .limit(30);

  let contexto = "";
  if (itens && itens.length > 0) {
    contexto =
      "\n\nBASE DE CONHECIMENTO DA CAMPANHA:\n" +
      itens
        .map((it) => {
          const tema = Array.isArray(it.temas_campanha)
            ? it.temas_campanha[0]
            : it.temas_campanha;
          return `- [${tema?.nome ?? "Geral"}] ${it.titulo}${it.descricao ? `: ${it.descricao}` : ""}`;
        })
        .join("\n");
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json({ error: "Nenhuma chave de IA configurada." }, { status: 400 });
  }

  const diretrizes = await obterContextoDiretrizes(supabase, eu.campanha_id);
  const normativa = await obterContextoNormativo(supabase, eu.campanha_id);

  try {
    const resposta = await ia.gerar({
      sistema: SISTEMA_CONSULTA_JURIDICA + contexto,
      mensagens: [{ role: "user", content: [diretrizes || null, normativa || null, pergunta.trim()].filter(Boolean).join("\n\n") }],
      maxTokens: 4000,
    });
    return NextResponse.json({ resposta, provedor: ia.provedor });
  } catch (err) {
    return respostaErroIA(err);
  }
}
