import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });

  const { data } = await supabase
    .from("narrativas_analises")
    .select("id, analise, resumo, provedor_ia, territorio_id, canal, periodo_inicio, periodo_fim, temas, tipo, created_at")
    .eq("campanha_id", eu.campanha_id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ analises: data ?? [] });
}
