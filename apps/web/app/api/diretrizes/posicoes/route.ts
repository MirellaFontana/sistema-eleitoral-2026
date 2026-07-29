import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTexto, sanitizarTextoOpcional } from "@/lib/sanitizar";

const PAPEIS_EDITAM = new Set(["coord_campanha", "candidato"]);

export async function POST(request: Request) {
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
  if (!body.posicao?.trim())
    return NextResponse.json({ error: "posição é obrigatória" }, { status: 400 });
  if (!body.tema_id && !body.tema_livre?.trim())
    return NextResponse.json({ error: "informe um tema" }, { status: 400 });

  const { error } = await supabase.from("diretrizes_posicoes").insert({
    campanha_id: eu.campanha_id,
    tema_id: body.tema_id || null,
    tema_livre: sanitizarTextoOpcional(body.tema_livre, 200),
    posicao: sanitizarTexto(body.posicao, 5000),
    evidencias: sanitizarTextoOpcional(body.evidencias, 5000),
    status: body.status || "definida",
    atualizada_por: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marcar diretriz principal como rascunho (posição nova = precisa re-aprovar)
  await supabase
    .from("diretrizes_campanha")
    .update({ status: "rascunho", updated_at: new Date().toISOString() })
    .eq("campanha_id", eu.campanha_id);

  return NextResponse.json({ ok: true });
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
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("diretrizes_posicoes")
    .update({
      posicao: body.posicao ? sanitizarTexto(body.posicao, 5000) : undefined,
      evidencias: sanitizarTextoOpcional(body.evidencias, 5000),
      status: body.status || "definida",
      tema_livre: sanitizarTextoOpcional(body.tema_livre, 200),
      atualizada_por: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .eq("campanha_id", eu.campanha_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("diretrizes_campanha")
    .update({ status: "rascunho", updated_at: new Date().toISOString() })
    .eq("campanha_id", eu.campanha_id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("diretrizes_posicoes")
    .delete()
    .eq("id", id)
    .eq("campanha_id", eu.campanha_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
