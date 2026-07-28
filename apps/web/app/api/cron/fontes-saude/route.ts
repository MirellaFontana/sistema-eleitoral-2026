import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: fontes } = await supabase
    .from("fontes_monitoramento")
    .select("id, dominio, falhas_consecutivas, total_acessos")
    .eq("ativo", true);

  if (!fontes || fontes.length === 0) {
    return NextResponse.json({ message: "nenhuma fonte ativa" });
  }

  const resultados: { dominio: string; status: number | null; ok: boolean }[] = [];

  for (const f of fontes) {
    let status: number | null = null;
    let ok = false;

    try {
      const res = await fetch(`https://${f.dominio}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(10_000),
      });
      status = res.status;
      ok = res.ok;
    } catch {
      ok = false;
    }

    await supabase
      .from("fontes_monitoramento")
      .update({
        ultimo_acesso_em: new Date().toISOString(),
        ultimo_status: status,
        falhas_consecutivas: ok ? 0 : f.falhas_consecutivas + 1,
        total_acessos: f.total_acessos + 1,
      })
      .eq("id", f.id);

    resultados.push({ dominio: f.dominio, status, ok });
  }

  return NextResponse.json({ resultados });
}
