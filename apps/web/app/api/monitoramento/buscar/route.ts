import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarTermo } from "@/lib/monitoramento-busca";

const PAPEIS_QUE_BUSCAM = new Set([
  "coord_campanha",
  "advogado_responsavel",
  "assistente_juridico",
  "coord_marketing",
  "redator_marketing",
]);

export async function GET() {
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

  if (!eu || !PAPEIS_QUE_BUSCAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão pra buscar menções" }, { status: 403 });
  }

  const { data: termos } = await supabase
    .from("termos_monitoramento")
    .select("id, termo, rotulo")
    .eq("ativo", true);

  if (!termos || termos.length === 0) {
    return NextResponse.json(
      { error: "Nenhum termo de monitoramento ativo — cadastre em \"O que monitorar\" antes de buscar." },
      { status: 400 },
    );
  }

  const twitterToken = process.env.TWITTER_BEARER_TOKEN;
  const grupos = await Promise.all(termos.map((t) => buscarTermo(t, twitterToken)));

  return NextResponse.json({ grupos });
}
