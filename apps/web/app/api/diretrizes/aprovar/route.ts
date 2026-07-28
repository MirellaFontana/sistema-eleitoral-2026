import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
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
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });
  if (!new Set(["coord_campanha", "candidato"]).has(eu.papel))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const { data: diretriz } = await supabase
    .from("diretrizes_campanha")
    .select("*")
    .eq("campanha_id", eu.campanha_id)
    .maybeSingle();

  if (!diretriz) return NextResponse.json({ error: "nenhuma diretriz cadastrada" }, { status: 404 });
  if (diretriz.status === "aprovada")
    return NextResponse.json({ error: "já está aprovada" }, { status: 400 });

  const { data: posicoes } = await supabase
    .from("diretrizes_posicoes")
    .select("*")
    .eq("campanha_id", eu.campanha_id);

  // Snapshot para histórico
  const snapshot = {
    identidade: diretriz.identidade,
    valores: diretriz.valores,
    vocabulario_preferido: diretriz.vocabulario_preferido,
    vocabulario_proibido: diretriz.vocabulario_proibido,
    assuntos_sensiveis: diretriz.assuntos_sensiveis,
    limites: diretriz.limites,
    mensagens_mae: diretriz.mensagens_mae,
    posicoes: posicoes ?? [],
  };

  const novaVersao = diretriz.versao + 1;

  await supabase.from("diretrizes_historico").insert({
    campanha_id: eu.campanha_id,
    versao: diretriz.versao,
    snapshot,
    alteracao: `Versão ${diretriz.versao} aprovada`,
    criado_por: user.id,
  });

  const { error } = await supabase
    .from("diretrizes_campanha")
    .update({
      status: "aprovada",
      versao: novaVersao,
      aprovada_por: user.id,
      aprovada_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", diretriz.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, versao: novaVersao });
}
