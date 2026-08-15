import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("ativos_politicos")
    .select(`
      *,
      categorias_ativo_politico(nome, grupo, cor),
      territorios(nome_bairro, cidade)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const [{ data: relacionamentos }, { data: historico }] = await Promise.all([
    supabase
      .from("relacionamentos_ativos")
      .select("id, ativo_origem_id, ativo_destino_id, observacoes, created_at, tipos_relacionamento_ativo(nome, direcional), origem:ativos_politicos!ativo_origem_id(id, nome), destino:ativos_politicos!ativo_destino_id(id, nome)")
      .or(`ativo_origem_id.eq.${id},ativo_destino_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("historico_ativos")
      .select("id, tipo, titulo, descricao, data_ocorrencia, created_at")
      .eq("ativo_id", id)
      .order("data_ocorrencia", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({ ativo: data, relacionamentos: relacionamentos ?? [], historico: historico ?? [] });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from("ativos_politicos")
    .update({
      nome: body.nome,
      nome_social: body.nome_social ?? null,
      telefone: body.telefone ?? null,
      whatsapp: body.whatsapp ?? null,
      email: body.email ?? null,
      cidade: body.cidade ?? null,
      estado: body.estado ?? null,
      endereco: body.endereco ?? null,
      bairro: body.bairro ?? null,
      categoria_id: body.categoria_id,
      subtipo: body.subtipo ?? null,
      cargo_atual: body.cargo_atual ?? null,
      cargo_anterior: body.cargo_anterior ?? null,
      partido: body.partido ?? null,
      entidade: body.entidade ?? null,
      setor: body.setor ?? null,
      territorio_id: body.territorio_id ?? null,
      nivel_influencia: body.nivel_influencia,
      abrangencia: body.abrangencia,
      relevancia_estrategica: body.relevancia_estrategica ?? null,
      capacidade_mobilizacao: body.capacidade_mobilizacao ?? null,
      pessoas_alcancadas_est: body.pessoas_alcancadas_est ?? null,
      status_campanha: body.status_campanha,
      observacoes: body.observacoes ?? null,
      atualizado_por: user.id,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { error } = await supabase.from("ativos_politicos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
