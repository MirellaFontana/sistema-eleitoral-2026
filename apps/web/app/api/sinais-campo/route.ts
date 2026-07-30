import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTextoOpcional } from "@/lib/sanitizar";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const tema = url.searchParams.get("tema");
  const territorio = url.searchParams.get("territorio");
  const pagina = Math.max(1, parseInt(url.searchParams.get("pagina") ?? "1"));
  const porPagina = 30;

  let query = supabase
    .from("sinais_campo")
    .select("*, usuarios_internos!sinais_campo_registrado_por_fkey(nome), territorios(nome_bairro, cidade)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((pagina - 1) * porPagina, pagina * porPagina - 1);

  if (tema) query = query.eq("tema", tema);
  if (territorio) query = query.eq("territorio_id", territorio);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sinais: data ?? [], total: count ?? 0, pagina, porPagina });
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

  const { data, error } = await supabase
    .from("sinais_campo")
    .insert({
      campanha_id: eu.campanha_id,
      registrado_por: user.id,
      territorio_id: body.territorio_id || null,
      evento_id: body.evento_id || null,
      local_descricao: sanitizarTextoOpcional(body.local_descricao, 500),
      data_registro: body.data_registro || new Date().toISOString().slice(0, 10),
      tema: sanitizarTextoOpcional(body.tema, 200),
      perguntas_objecoes: Array.isArray(body.perguntas_objecoes)
        ? body.perguntas_objecoes.map((p: unknown) => typeof p === "string" ? p.trim().slice(0, 1000) : "")
        : [],
      reacao_discurso: sanitizarTextoOpcional(body.reacao_discurso, 2000),
      discurso_concorrente: sanitizarTextoOpcional(body.discurso_concorrente, 2000),
      frase_representativa: sanitizarTextoOpcional(body.frase_representativa, 500),
      intensidade: body.intensidade || "moderada",
      contagem_pessoas: body.contagem_pessoas || 1,
      observacoes: sanitizarTextoOpcional(body.observacoes, 5000),
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

  const campos: Record<string, unknown> = {};
  if (body.encaminhamento !== undefined) campos.encaminhamento = sanitizarTextoOpcional(body.encaminhamento, 2000);
  if (body.encaminhado_para !== undefined) campos.encaminhado_para = body.encaminhado_para;
  if (body.encaminhamento_status !== undefined) campos.encaminhamento_status = body.encaminhamento_status;
  if (body.encaminhado_para) campos.encaminhado_em = new Date().toISOString();

  const { data, error } = await supabase
    .from("sinais_campo")
    .update(campos)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
