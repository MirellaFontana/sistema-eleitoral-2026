import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const tabela = url.searchParams.get("tabela");
  const usuario = url.searchParams.get("usuario");
  const acao = url.searchParams.get("acao");
  const de = url.searchParams.get("de");
  const ate = url.searchParams.get("ate");
  const pagina = Math.max(1, parseInt(url.searchParams.get("pagina") ?? "1"));
  const porPagina = 50;

  let query = supabase
    .from("log_auditoria")
    .select("id, acao, tabela_afetada, entidade_id, antes, depois, created_at, usuario_id, usuarios_internos(nome)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((pagina - 1) * porPagina, pagina * porPagina - 1);

  if (tabela) query = query.eq("tabela_afetada", tabela);
  if (usuario) query = query.eq("usuario_id", usuario);
  if (acao) query = query.ilike("acao", `%${acao}%`);
  if (de) query = query.gte("created_at", de);
  if (ate) query = query.lte("created_at", ate);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    eventos: data ?? [],
    total: count ?? 0,
    pagina,
    porPagina,
  });
}
