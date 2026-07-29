import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("evidencias_decisao")
    .select("*")
    .eq("decisao_id", id)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ evidencias: data ?? [] });
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
    .from("evidencias_decisao")
    .insert({
      decisao_id: id,
      campanha_id: eu.campanha_id,
      tipo: body.tipo,
      referencia_id: body.referencia_id ?? null,
      titulo: body.titulo,
      descricao: body.descricao ?? null,
      dados: body.dados ?? {},
      registrado_por: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ evidencia: data });
}
