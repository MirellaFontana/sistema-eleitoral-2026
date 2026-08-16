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

  const { data, error } = await supabase
    .from("eleicoes_proporcionais")
    .select("*, chapas_proporcionais(count)")
    .eq("campanha_id", eu.campanha_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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
  if (!body.cargo || !body.estado || !body.vagas || !body.ano) {
    return NextResponse.json({ error: "cargo, estado, vagas e ano são obrigatórios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("eleicoes_proporcionais")
    .insert({
      campanha_id: eu.campanha_id,
      cargo: body.cargo,
      estado: body.estado,
      vagas: body.vagas,
      ano: body.ano,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
