import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data } = await supabase
    .from("fontes_monitoramento")
    .select("id, nome, dominio, tier, ativo, ultimo_acesso_em, ultimo_status, falhas_consecutivas, total_acessos, observacoes")
    .order("falhas_consecutivas", { ascending: false });

  const fontes = (data ?? []).map((f) => {
    const horasDesdeAcesso = f.ultimo_acesso_em
      ? (Date.now() - new Date(f.ultimo_acesso_em).getTime()) / 3_600_000
      : null;

    let saude: "ok" | "alerta" | "falha" | "inativa" = "ok";
    if (!f.ativo) saude = "inativa";
    else if (f.falhas_consecutivas >= 3) saude = "falha";
    else if (f.falhas_consecutivas >= 1 || (horasDesdeAcesso && horasDesdeAcesso > 48)) saude = "alerta";

    return { ...f, saude, horas_desde_acesso: horasDesdeAcesso ? Math.round(horasDesdeAcesso) : null };
  });

  return NextResponse.json({ fontes });
}
