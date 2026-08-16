import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ eleicaoId: string; chapaId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { eleicaoId, chapaId } = await ctx.params;
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
    .from("chapas_proporcionais")
    .select("*, candidaturas_chapa(*)")
    .eq("id", chapaId)
    .eq("eleicao_id", eleicaoId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request, ctx: Ctx) {
  const { eleicaoId, chapaId } = await ctx.params;
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

  const body = await request.json();

  const { data, error } = await supabase
    .from("chapas_proporcionais")
    .update({
      partido: body.partido,
      federacao: body.federacao,
      nome_coligacao: body.nome_coligacao,
      votos_legenda_estimados: body.votos_legenda_estimados,
    })
    .eq("id", chapaId)
    .eq("eleicao_id", eleicaoId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { eleicaoId, chapaId } = await ctx.params;
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

  const { error } = await supabase
    .from("chapas_proporcionais")
    .delete()
    .eq("id", chapaId)
    .eq("eleicao_id", eleicaoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
