import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterRegra, analisarCotaGenero } from "@/lib/regras-eleitorais";

type Ctx = { params: Promise<{ eleicaoId: string }> };

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
    .select("ano")
    .eq("id", eleicaoId)
    .eq("campanha_id", eu.campanha_id)
    .single();
  if (!eleicao) return NextResponse.json({ error: "eleição não encontrada" }, { status: 404 });

  const { data, error } = await supabase
    .from("chapas_proporcionais")
    .select("*, candidaturas_proporcionais(genero)")
    .eq("eleicao_id", eleicaoId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const regra = obterRegra(eleicao.ano);
  const resultado = (data ?? []).map((chapa) => {
    const cands = chapa.candidaturas_proporcionais ?? [];
    const masc = cands.filter((c: { genero: string }) => c.genero === "masculino").length;
    const fem = cands.filter((c: { genero: string }) => c.genero === "feminino").length;
    return {
      ...chapa,
      total_candidaturas: cands.length,
      cota_genero: analisarCotaGenero(masc, fem, regra),
    };
  });

  return NextResponse.json(resultado);
}

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
    .select("id")
    .eq("id", eleicaoId)
    .eq("campanha_id", eu.campanha_id)
    .single();
  if (!eleicao) return NextResponse.json({ error: "eleição não encontrada" }, { status: 404 });

  const body = await request.json();
  if (!body.partido) {
    return NextResponse.json({ error: "partido é obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("chapas_proporcionais")
    .insert({
      eleicao_id: eleicaoId,
      partido: body.partido,
      federacao: body.federacao || null,
      nome_coligacao: body.nome_coligacao || null,
      votos_legenda_estimados: body.votos_legenda_estimados ?? 0,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
