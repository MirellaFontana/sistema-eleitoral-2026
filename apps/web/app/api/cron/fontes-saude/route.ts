import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verificarCronAuth } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const authErr = verificarCronAuth(request);
  if (authErr) return authErr;

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
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; EleitoBot/1.0; +https://eleito.online)" },
        redirect: "follow",
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
