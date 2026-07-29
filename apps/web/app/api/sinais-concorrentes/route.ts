import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTexto, sanitizarTextoOpcional } from "@/lib/sanitizar";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const concorrenteId = url.searchParams.get("concorrente_id");

  let query = supabase
    .from("sinais_concorrentes")
    .select("*, concorrentes(nome), usuarios_internos!sinais_concorrentes_registrado_por_fkey(nome)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (concorrenteId) query = query.eq("concorrente_id", concorrenteId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sinais: data ?? [] });
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
  if (!body.concorrente_id || !body.titulo)
    return NextResponse.json({ error: "concorrente_id e titulo obrigatórios" }, { status: 400 });

  const { data, error } = await supabase
    .from("sinais_concorrentes")
    .insert({
      campanha_id: eu.campanha_id,
      registrado_por: user.id,
      concorrente_id: body.concorrente_id,
      tipo: body.tipo || "outro",
      titulo: sanitizarTexto(body.titulo, 500),
      descricao: sanitizarTextoOpcional(body.descricao, 5000),
      fonte: sanitizarTextoOpcional(body.fonte, 500),
      url: sanitizarTextoOpcional(body.url, 2000),
      data_ocorrencia: body.data_ocorrencia || null,
      impacto: body.impacto || null,
      resposta_sugerida: body.resposta_sugerida || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
