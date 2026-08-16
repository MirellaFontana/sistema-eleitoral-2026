import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { simular } from "@/lib/calculo-proporcional";
import { obterRegra } from "@/lib/regras-eleitorais";

type Ctx = { params: Promise<{ eleicaoId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { eleicaoId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });

  const { data: eleicao } = await supabase
    .from("eleicoes_proporcionais")
    .select("ano, vagas")
    .eq("id", eleicaoId)
    .eq("campanha_id", eu.campanha_id)
    .single();
  if (!eleicao) return NextResponse.json({ error: "eleição não encontrada" }, { status: 404 });

  const body = await request.json();
  if (!body.votos_validos_estimados || !body.partidos) {
    return NextResponse.json({ error: "votos_validos_estimados e partidos são obrigatórios" }, { status: 400 });
  }

  const regra = obterRegra(eleicao.ano);
  const resultado = simular(body.votos_validos_estimados, eleicao.vagas, body.partidos, regra);

  const { data, error } = await supabase
    .from("simulacoes_proporcionais")
    .insert({
      eleicao_id: eleicaoId,
      cenario: body.cenario || null,
      titulo: body.titulo || null,
      votos_validos_estimados: body.votos_validos_estimados,
      entrada: body.partidos,
      resultado,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, resultado }, { status: 201 });
}

export async function GET(_req: Request, ctx: Ctx) {
  const { eleicaoId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });

  const { data: eleicao } = await supabase
    .from("eleicoes_proporcionais")
    .select("id")
    .eq("id", eleicaoId)
    .eq("campanha_id", eu.campanha_id)
    .single();
  if (!eleicao) return NextResponse.json({ error: "eleição não encontrada" }, { status: 404 });

  const { data, error } = await supabase
    .from("simulacoes_proporcionais")
    .select("id, cenario, titulo, votos_validos_estimados, resultado, created_at")
    .eq("eleicao_id", eleicaoId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
