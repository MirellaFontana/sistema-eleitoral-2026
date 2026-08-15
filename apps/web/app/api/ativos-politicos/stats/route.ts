import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const [
    { count: total },
    { count: geolocalizados },
    { data: ativos },
  ] = await Promise.all([
    supabase.from("ativos_politicos").select("id", { count: "exact", head: true }),
    supabase.from("ativos_politicos").select("id", { count: "exact", head: true }).not("geolocalizacao", "is", null),
    supabase
      .from("ativos_politicos")
      .select("nivel_influencia, status_campanha, partido, categoria_id, categorias_ativo_politico(nome, grupo)"),
  ]);

  const categoriaCounts: Record<string, number> = {};
  const nivelCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const partidoCounts: Record<string, number> = {};

  for (const a of ativos ?? []) {
    const cat = (Array.isArray(a.categorias_ativo_politico) ? a.categorias_ativo_politico[0] : a.categorias_ativo_politico) as { nome: string; grupo: string } | null;
    const catNome = cat?.nome ?? "Sem categoria";
    categoriaCounts[catNome] = (categoriaCounts[catNome] ?? 0) + 1;
    nivelCounts[a.nivel_influencia] = (nivelCounts[a.nivel_influencia] ?? 0) + 1;
    statusCounts[a.status_campanha] = (statusCounts[a.status_campanha] ?? 0) + 1;
    if (a.partido) partidoCounts[a.partido] = (partidoCounts[a.partido] ?? 0) + 1;
  }

  return NextResponse.json({
    total: total ?? 0,
    geolocalizados: geolocalizados ?? 0,
    porCategoria: Object.entries(categoriaCounts)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd),
    porNivel: Object.entries(nivelCounts)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd),
    porStatus: Object.entries(statusCounts)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd),
    porPartido: Object.entries(partidoCounts)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 15),
  });
}
