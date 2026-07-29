import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTexto, sanitizarTextoOpcional } from "@/lib/sanitizar";

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
    artigo: sanitizarTextoOpcional(body.artigo, 100),
    paragrafo: sanitizarTextoOpcional(body.paragrafo, 100),
    inciso: sanitizarTextoOpcional(body.inciso, 100),
    alinea: sanitizarTextoOpcional(body.alinea, 100),
    texto: sanitizarTexto(body.texto, 10000),
    tema: sanitizarTextoOpcional(body.tema, 200),
    cargo: sanitizarTextoOpcional(body.cargo, 200),
    etapa: sanitizarTextoOpcional(body.etapa, 200),
    vigencia_inicio: body.vigencia_inicio || null,
    vigencia_fim: body.vigencia_fim || null,
    alterado_por: sanitizarTextoOpcional(body.alterado_por, 500),
    observacoes: sanitizarTextoOpcional(body.observacoes, 5000),
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

  const LIMITES: Record<string, number> = { artigo: 100, paragrafo: 100, inciso: 100, alinea: 100, texto: 10000, tema: 200, cargo: 200, etapa: 200, alterado_por: 500, observacoes: 5000 };
  const campos: Record<string, unknown> = {};
  for (const k of ["artigo", "paragrafo", "inciso", "alinea", "texto", "tema", "cargo", "etapa", "vigencia_inicio", "vigencia_fim", "alterado_por", "status", "observacoes"]) {
    if (body[k] !== undefined) {
      const v = body[k] || null;
      campos[k] = v && LIMITES[k] ? sanitizarTexto(v, LIMITES[k]) : v;
    }
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
