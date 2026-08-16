import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ eleicaoId: string; chapaId: string; candidaturaId: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  const { eleicaoId, candidaturaId } = await ctx.params;
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
    .from("candidaturas_chapa")
    .update({
      nome: body.nome,
      nome_urna: body.nome_urna,
      numero: body.numero,
      genero: body.genero,
      partido: body.partido,
      votos_historicos: body.votos_historicos,
      votos_projetados: body.votos_projetados,
      territorio_principal: body.territorio_principal,
      municipios_forca: body.municipios_forca,
      ativo_politico_id: body.ativo_politico_id,
      status: body.status,
      observacoes_estrategicas: body.observacoes_estrategicas,
      potencial_mobilizacao: body.potencial_mobilizacao,
    })
    .eq("id", candidaturaId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { eleicaoId, candidaturaId } = await ctx.params;
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
    .from("candidaturas_chapa")
    .delete()
    .eq("id", candidaturaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
