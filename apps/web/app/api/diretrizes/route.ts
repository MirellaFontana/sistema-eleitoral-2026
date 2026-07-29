import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTextoOpcional } from "@/lib/sanitizar";

const PAPEIS_EDITAM = new Set(["coord_campanha", "candidato"]);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });

  const { data: diretriz } = await supabase
    .from("diretrizes_campanha")
    .select("*")
    .eq("campanha_id", eu.campanha_id)
    .maybeSingle();

  const { data: posicoes } = await supabase
    .from("diretrizes_posicoes")
    .select("*, temas_campanha(nome)")
    .eq("campanha_id", eu.campanha_id)
    .order("created_at");

  const { data: historico } = await supabase
    .from("diretrizes_historico")
    .select("id, versao, alteracao, criado_por, created_at")
    .eq("campanha_id", eu.campanha_id)
    .order("versao", { ascending: false })
    .limit(20);

  return NextResponse.json({
    diretriz,
    posicoes: posicoes ?? [],
    historico: historico ?? [],
    podeEditar: PAPEIS_EDITAM.has(eu.papel),
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });
  if (!PAPEIS_EDITAM.has(eu.papel))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const body = await request.json();
  const campos = {
    identidade: sanitizarTextoOpcional(body.identidade, 5000),
    valores: sanitizarTextoOpcional(body.valores, 5000),
    vocabulario_preferido: Array.isArray(body.vocabulario_preferido) ? body.vocabulario_preferido : [],
    vocabulario_proibido: Array.isArray(body.vocabulario_proibido) ? body.vocabulario_proibido : [],
    assuntos_sensiveis: Array.isArray(body.assuntos_sensiveis) ? body.assuntos_sensiveis : [],
    limites: sanitizarTextoOpcional(body.limites, 5000),
    mensagens_mae: Array.isArray(body.mensagens_mae) ? body.mensagens_mae : [],
    atualizada_por: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: existente } = await supabase
    .from("diretrizes_campanha")
    .select("id")
    .eq("campanha_id", eu.campanha_id)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("diretrizes_campanha")
      .update({ ...campos, status: "rascunho" })
      .eq("id", existente.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("diretrizes_campanha")
      .insert({ campanha_id: eu.campanha_id, ...campos });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
