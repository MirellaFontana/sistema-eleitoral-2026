import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("resultados_decisao")
    .select("*")
    .eq("decisao_id", id)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resultados: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });

  const body = await req.json();

  const { data, error } = await supabase
    .from("resultados_decisao")
    .insert({
      decisao_id: id,
      acao_id: body.acao_id ?? null,
      campanha_id: eu.campanha_id,
      descricao: body.descricao,
      avaliacao: body.avaliacao ?? null,
      indicadores: body.indicadores ?? {},
      aprendizado: body.aprendizado ?? null,
      registrado_por: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resultado: data });
}
