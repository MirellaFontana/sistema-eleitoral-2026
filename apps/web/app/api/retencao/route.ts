import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("configuracoes_retencao")
    .select("*")
    .order("tabela");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data ?? [] });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const campos: Record<string, unknown> = {
    atualizado_por: user.id,
    updated_at: new Date().toISOString(),
  };
  if (body.dias_retencao !== undefined) campos.dias_retencao = body.dias_retencao;
  if (body.acao !== undefined) campos.acao = body.acao;
  if (body.ativo !== undefined) campos.ativo = body.ativo;

  const { data, error } = await supabase
    .from("configuracoes_retencao")
    .update(campos)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
