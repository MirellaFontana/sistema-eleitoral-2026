import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not auth" }, { status: 401 });

  const [campanha, papel, isDev, isAdv, interno] = await Promise.all([
    supabase.rpc("current_campanha_id"),
    supabase.rpc("current_papel"),
    supabase.rpc("is_dev_plataforma"),
    supabase.rpc("is_advogado_externo"),
    supabase.from("usuarios_internos").select("campanha_id, papel, status, funcao_id").eq("id", user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    auth_uid: user.id,
    email: user.email,
    current_campanha_id: campanha.data,
    current_campanha_error: campanha.error?.message,
    current_papel: papel.data,
    is_dev: isDev.data,
    is_adv: isAdv.data,
    usuarios_internos: interno.data,
  });
}
