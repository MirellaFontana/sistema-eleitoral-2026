import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const loteId = url.searchParams.get("lote_id");
  const status = url.searchParams.get("status");
  const pagina = Math.max(1, parseInt(url.searchParams.get("pagina") ?? "1"));
  const porPagina = 50;

  if (loteId) {
    let query = supabase
      .from("quarentena_registros")
      .select("*", { count: "exact" })
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false })
      .range((pagina - 1) * porPagina, pagina * porPagina - 1);

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ registros: data ?? [], total: count ?? 0, pagina, porPagina });
  }

  const { data: lotes, error } = await supabase
    .from("lotes_importacao")
    .select("*, usuarios_internos!lotes_importacao_importado_por_fkey(nome)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lotes: lotes ?? [] });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { data, error } = await supabase
    .from("quarentena_registros")
    .update({
      status: body.status,
      motivo_rejeicao: body.motivo_rejeicao || null,
      revisado_por: user.id,
      revisado_em: new Date().toISOString(),
    })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
