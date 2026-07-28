import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executarSnapshotCampanha } from "@/lib/monitoramento-snapshot";

const PAPEIS_QUE_EXECUTAM = new Set([
  "coord_campanha",
  "advogado_responsavel",
  "assistente_juridico",
  "coord_marketing",
  "redator_marketing",
]);

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_EXECUTAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;
  const resultado = await executarSnapshotCampanha(
    supabase,
    eu.campanha_id,
    campanha?.nome_candidato ?? null,
  );

  return NextResponse.json(resultado);
}
