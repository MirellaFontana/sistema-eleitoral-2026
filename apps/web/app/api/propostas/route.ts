import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTexto, sanitizarTextoOpcional } from "@/lib/sanitizar";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const tema = url.searchParams.get("tema");

  let query = supabase
    .from("propostas")
    .select("*, usuarios_internos!propostas_criado_por_fkey(nome)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (tema) query = query.eq("tema", tema);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ propostas: data ?? [] });
}

export async function POST(request: Request) {
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
  if (!body.titulo || !body.descricao)
    return NextResponse.json({ error: "titulo e descricao obrigatórios" }, { status: 400 });

  const { data, error } = await supabase
    .from("propostas")
    .insert({
      campanha_id: eu.campanha_id,
      criado_por: user.id,
      titulo: sanitizarTexto(body.titulo, 500),
      descricao: sanitizarTexto(body.descricao, 5000),
      tema: sanitizarTextoOpcional(body.tema, 200),
      territorio: sanitizarTextoOpcional(body.territorio, 200),
      publico_alvo: sanitizarTextoOpcional(body.publico_alvo, 500),
      fundamentacao: sanitizarTextoOpcional(body.fundamentacao, 5000),
      impacto_estimado: sanitizarTextoOpcional(body.impacto_estimado, 2000),
      custo_estimado: sanitizarTextoOpcional(body.custo_estimado, 500),
      prazo: body.prazo || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const campos: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["titulo", "descricao", "tema", "territorio", "publico_alvo", "fundamentacao", "impacto_estimado", "custo_estimado", "prazo", "status"]) {
    if (body[k] !== undefined) campos[k] = body[k];
  }
  if (body.status === "aprovada") {
    campos.aprovada_por = user.id;
    campos.aprovada_em = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("propostas")
    .update(campos)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
