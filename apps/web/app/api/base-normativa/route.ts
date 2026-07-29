import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTexto, sanitizarTextoOpcional } from "@/lib/sanitizar";

const PAPEIS_EDITAM = new Set(["coord_campanha", "advogado_responsavel", "assistente_juridico"]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: fontes } = await supabase
    .from("fontes_normativas")
    .select("*, dispositivos_normativos(id, artigo, paragrafo, inciso, alinea, texto, tema, cargo, etapa, vigencia_inicio, vigencia_fim, alterado_por, status, observacoes)")
    .order("tipo").order("ano", { ascending: false });

  return NextResponse.json({ fontes: fontes ?? [] });
}

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
  const { data, error } = await supabase.from("fontes_normativas").insert({
    campanha_id: eu.campanha_id,
    autoridade: body.autoridade ?? "tse",
    tipo: body.tipo ?? "lei",
    numero: body.numero || null,
    ano: body.ano || null,
    titulo: sanitizarTexto(body.titulo, 500),
    ementa: sanitizarTextoOpcional(body.ementa, 2000),
    eleicao_ciclo: body.eleicao_ciclo || null,
    url_oficial: sanitizarTextoOpcional(body.url_oficial, 2000),
    data_publicacao: body.data_publicacao || null,
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

  const campos: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["autoridade", "tipo", "numero", "ano", "titulo", "ementa", "eleicao_ciclo", "url_oficial", "data_publicacao", "data_verificacao", "hash_conteudo", "observacoes"]) {
    if (body[k] !== undefined) campos[k] = body[k] || null;
  }

  if (body.status === "validada") {
    campos.status = "validada";
    campos.validado_por = user.id;
    campos.validado_em = new Date().toISOString();
  } else if (body.status) {
    campos.status = body.status;
  }

  const { error } = await supabase
    .from("fontes_normativas")
    .update(campos)
    .eq("id", body.id)
    .eq("campanha_id", eu.campanha_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
