import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const categoria = url.searchParams.get("categoria");
  const cidade = url.searchParams.get("cidade");
  const partido = url.searchParams.get("partido");
  const nivel = url.searchParams.get("nivel");
  const status = url.searchParams.get("status");
  const busca = url.searchParams.get("busca");
  const pagina = Math.max(1, parseInt(url.searchParams.get("pagina") ?? "1"));
  const porPagina = Math.min(200, Math.max(1, parseInt(url.searchParams.get("porPagina") ?? "50")));

  let query = supabase
    .from("ativos_politicos")
    .select(
      "id, nome, nome_social, cidade, estado, partido, cargo_atual, nivel_influencia, status_campanha, geolocalizacao, created_at, categoria_id, categorias_ativo_politico(nome, grupo)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((pagina - 1) * porPagina, pagina * porPagina - 1);

  if (categoria) query = query.eq("categoria_id", categoria);
  if (cidade) query = query.ilike("cidade", `%${cidade}%`);
  if (partido) query = query.ilike("partido", `%${partido}%`);
  if (nivel) query = query.eq("nivel_influencia", nivel);
  if (status) query = query.eq("status_campanha", status);
  if (busca) query = query.or(`nome.ilike.%${busca}%,nome_social.ilike.%${busca}%,cargo_atual.ilike.%${busca}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ativos: data ?? [], total: count ?? 0, pagina, porPagina });
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
    .from("ativos_politicos")
    .insert({
      campanha_id: eu.campanha_id,
      nome: body.nome,
      nome_social: body.nome_social || null,
      telefone: body.telefone || null,
      whatsapp: body.whatsapp || null,
      email: body.email || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      endereco: body.endereco || null,
      bairro: body.bairro || null,
      categoria_id: body.categoria_id,
      subtipo: body.subtipo || null,
      cargo_atual: body.cargo_atual || null,
      cargo_anterior: body.cargo_anterior || null,
      partido: body.partido || null,
      entidade: body.entidade || null,
      setor: body.setor || null,
      territorio_id: body.territorio_id || null,
      nivel_influencia: body.nivel_influencia || "nao_avaliado",
      abrangencia: body.abrangencia || "municipal",
      relevancia_estrategica: body.relevancia_estrategica || null,
      capacidade_mobilizacao: body.capacidade_mobilizacao || null,
      pessoas_alcancadas_est: body.pessoas_alcancadas_est || null,
      status_campanha: body.status_campanha || "identificado",
      observacoes: body.observacoes || null,
      criado_por: user.id,
      atualizado_por: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
