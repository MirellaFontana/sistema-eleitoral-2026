import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTexto, sanitizarTextoOpcional } from "@/lib/sanitizar";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("decisoes")
    .select("*, registrado_por_nome:usuarios_internos!decisoes_registrado_por_fkey(nome), responsavel_nome:usuarios_internos!decisoes_responsavel_id_fkey(nome)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ decisoes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });

  const body = await request.json();

  const { data, error } = await supabase
    .from("decisoes")
    .insert({
      campanha_id: eu.campanha_id,
      titulo: sanitizarTexto(body.titulo, 500),
      descricao: sanitizarTextoOpcional(body.descricao, 2000),
      evidencias: body.evidencias ?? [],
      recomendacao_id: body.recomendacao_id ?? null,
      proposta_id: body.proposta_id ?? null,
      registrado_por: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decisao: data });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const campos: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["titulo", "descricao", "contexto", "status", "resultado", "qualidade_resultado", "tema"]) {
    if (body[k] !== undefined) campos[k] = body[k];
  }

  if (campos.status === "decidida") {
    campos.decidida_por = user.id;
    campos.decidida_em = new Date().toISOString();
  }
  if (campos.resultado) {
    campos.resultado_registrado_em = new Date().toISOString();
  }

  const { error } = await supabase
    .from("decisoes")
    .update(campos)
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
