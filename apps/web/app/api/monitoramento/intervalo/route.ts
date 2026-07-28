import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAPEIS_QUE_CONFIGURAM = new Set([
  "coord_campanha",
  "advogado_responsavel",
  "coord_marketing",
]);

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

  if (!eu || !PAPEIS_QUE_CONFIGURAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const horas = body.horas as number | null;

  if (horas !== null && (typeof horas !== "number" || horas < 1 || horas > 24)) {
    return NextResponse.json(
      { error: "intervalo deve ser entre 1 e 24 horas, ou null para desativar" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("campanhas")
    .update({ intervalo_monitoramento_horas: horas })
    .eq("id", eu.campanha_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, intervalo: horas });
}
