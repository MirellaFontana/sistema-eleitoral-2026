import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("campanha_id, papel")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });

  if (!["coord_campanha", "candidato", "coord_marketing"].includes(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const texto = (body.texto ?? "").trim();
  if (!texto) return NextResponse.json({ error: "texto vazio" }, { status: 400 });

  const { error } = await supabase.from("narrativas_analises").insert({
    campanha_id: eu.campanha_id,
    analise: [],
    resumo: texto,
    tipo: "relatorio_manual",
    provedor_ia: null,
    criado_por: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
