import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTexto } from "@/lib/sanitizar";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("acoes_decisao")
    .select("*, responsavel_nome:usuarios_internos!acoes_decisao_responsavel_id_fkey(nome)")
    .eq("decisao_id", id)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ acoes: data ?? [] });
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
    .from("acoes_decisao")
    .insert({
      decisao_id: id,
      campanha_id: eu.campanha_id,
      descricao: sanitizarTexto(body.descricao, 2000),
      responsavel_id: body.responsavel_id ?? null,
      prazo: body.prazo ?? null,
      registrado_por: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ acao: data });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json();
  const { acao_id, ...campos } = body;
  if (!acao_id) return NextResponse.json({ error: "acao_id obrigatório" }, { status: 400 });

  campos.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("acoes_decisao")
    .update(campos)
    .eq("id", acao_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
