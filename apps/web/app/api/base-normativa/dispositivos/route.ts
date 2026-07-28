import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAPEIS_EDITAM = new Set(["coord_campanha", "advogado_responsavel", "assistente_juridico"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu || !PAPEIS_EDITAM.has(eu.papel))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const body = await request.json();
  if (!body.fonte_id) return NextResponse.json({ error: "fonte_id obrigatório" }, { status: 400 });

  const { data, error } = await supabase.from("dispositivos_normativos").insert({
    campanha_id: eu.campanha_id,
    fonte_id: body.fonte_id,
    artigo: body.artigo || null,
    paragrafo: body.paragrafo || null,
    inciso: body.inciso || null,
    alinea: body.alinea || null,
    texto: body.texto,
    tema: body.tema || null,
    cargo: body.cargo || null,
    etapa: body.etapa || null,
    vigencia_inicio: body.vigencia_inicio || null,
    vigencia_fim: body.vigencia_fim || null,
    alterado_por: body.alterado_por || null,
    observacoes: body.observacoes || null,
    criado_por: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu || !PAPEIS_EDITAM.has(eu.papel))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const campos: Record<string, unknown> = {};
  for (const k of ["artigo", "paragrafo", "inciso", "alinea", "texto", "tema", "cargo", "etapa", "vigencia_inicio", "vigencia_fim", "alterado_por", "status", "observacoes"]) {
    if (body[k] !== undefined) campos[k] = body[k] || null;
  }

  const { error } = await supabase
    .from("dispositivos_normativos")
    .update(campos)
    .eq("id", body.id)
    .eq("campanha_id", eu.campanha_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu || !new Set(["coord_campanha", "advogado_responsavel"]).has(eu.papel))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("dispositivos_normativos")
    .delete()
    .eq("id", id)
    .eq("campanha_id", eu.campanha_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
