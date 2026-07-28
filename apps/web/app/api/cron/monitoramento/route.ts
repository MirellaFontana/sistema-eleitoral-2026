import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { executarSnapshotCampanha } from "@/lib/monitoramento-snapshot";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: campanhas } = await supabase
    .from("campanhas")
    .select("id, nome_candidato, intervalo_monitoramento_horas");

  if (!campanhas || campanhas.length === 0) {
    return NextResponse.json({ message: "nenhuma campanha cadastrada" });
  }

  const resultados: { campanha_id: string; ok: boolean; pulado?: boolean; erro?: string }[] = [];

  for (const campanha of campanhas) {
    const intervalo = campanha.intervalo_monitoramento_horas;
    if (!intervalo || intervalo <= 0) {
      resultados.push({ campanha_id: campanha.id, ok: true, pulado: true });
      continue;
    }

    const { data: ultimo } = await supabase
      .from("monitoramento_snapshots")
      .select("created_at")
      .eq("campanha_id", campanha.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimo) {
      const horasDesdeUltimo =
        (Date.now() - new Date(ultimo.created_at).getTime()) / (1000 * 60 * 60);
      if (horasDesdeUltimo < intervalo) {
        resultados.push({ campanha_id: campanha.id, ok: true, pulado: true });
        continue;
      }
    }

    const resultado = await executarSnapshotCampanha(
      supabase,
      campanha.id,
      campanha.nome_candidato,
    );
    resultados.push({ campanha_id: campanha.id, ...resultado });
  }

  return NextResponse.json({ resultados });
}
