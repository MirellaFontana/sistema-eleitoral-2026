import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Expira registros pendentes com mais de 30 dias
  const limite = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { count } = await supabase
    .from("quarentena_registros")
    .update({ status: "expirado" })
    .eq("status", "pendente")
    .lt("created_at", limite);

  return NextResponse.json({ expirados: count ?? 0 });
}
