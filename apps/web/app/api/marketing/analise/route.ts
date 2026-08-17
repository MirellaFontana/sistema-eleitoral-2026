import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  SISTEMA_ANALISE_CAMPANHA,
  SISTEMA_ANALISE_MARKETING_CONCORRENTES,
} from "@/lib/anthropic";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { carregarContexto, montarMensagemContexto } from "@/lib/contexto-campanha";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const tipo = (body as { tipo?: string }).tipo === "marketing_concorrentes" ? "marketing_concorrentes" : "pontos_cegos";
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
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "seu papel não gera análise de campanha" }, { status: 403 });
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json(
      { error: "Nenhuma chave de IA configurada. Vá em Cadastro de Campanha > Chaves de API." },
      { status: 400 }
    );
  }

  const ctx = await carregarContexto(supabase, eu.campanha_id, ["diretrizes", "temas", "concorrentes", "demandas"]);

  const contexto = montarMensagemContexto(ctx);

  const sistema = tipo === "marketing_concorrentes" ? SISTEMA_ANALISE_MARKETING_CONCORRENTES : SISTEMA_ANALISE_CAMPANHA;
  let analise: string;
  try {
    analise = await ia.gerar({
      sistema,
      mensagens: [{ role: "user", content: contexto }],
      maxTokens: tipo === "marketing_concorrentes" ? 3000 : 1500,
    });
  } catch (err) {
    return respostaErroIA(err);
  }

  const { data: row, error } = await supabase
    .from("analises_campanha")
    .insert({
      campanha_id: eu.campanha_id,
      tipo,
      analise,
      modelo_ia: ia.provedor,
    })
    .select("id, analise, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
