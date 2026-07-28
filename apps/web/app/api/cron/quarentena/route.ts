import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verificarCronAuth } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const authErr = verificarCronAuth(request);
  if (authErr) return authErr;

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
