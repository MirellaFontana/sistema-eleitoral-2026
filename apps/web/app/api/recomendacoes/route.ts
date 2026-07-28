import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAPEIS_DECIDEM = new Set(["coord_campanha", "candidato"]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });

  const { data } = await supabase
    .from("recomendacoes")
    .select("*, decidido_por_nome:usuarios_internos!recomendacoes_decidido_por_fkey(nome), acao_responsavel_nome:usuarios_internos!recomendacoes_acao_responsavel_fkey(nome)")
    .eq("campanha_id", eu.campanha_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    recomendacoes: data ?? [],
    podeDecidir: PAPEIS_DECIDEM.has(eu.papel),
  });
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
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });
  if (!PAPEIS_DECIDEM.has(eu.papel))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const campos: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status) campos.status = body.status;
  if (body.decisao_texto !== undefined) {
    campos.decisao_texto = body.decisao_texto;
    campos.decidido_por = user.id;
    campos.decidido_em = new Date().toISOString();
  }
  if (body.acao_titulo !== undefined) campos.acao_titulo = body.acao_titulo;
  if (body.acao_descricao !== undefined) campos.acao_descricao = body.acao_descricao;
  if (body.acao_prazo !== undefined) campos.acao_prazo = body.acao_prazo;
  if (body.resultado_texto !== undefined) {
    campos.resultado_texto = body.resultado_texto;
    campos.resultado_registrado_por = user.id;
    campos.resultado_registrado_em = new Date().toISOString();
  }
  if (body.aprendizagem !== undefined) campos.aprendizagem = body.aprendizagem;
  if (body.avaliacao_qualidade !== undefined) campos.avaliacao_qualidade = body.avaliacao_qualidade;

  const { error } = await supabase
    .from("recomendacoes")
    .update(campos)
    .eq("id", body.id)
    .eq("campanha_id", eu.campanha_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
