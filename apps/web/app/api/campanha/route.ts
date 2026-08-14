import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { campanhaId } = (await req.json()) as { campanhaId?: string };
  if (!campanhaId) return NextResponse.json({ error: "campanhaId obrigatório" }, { status: 400 });

  const { error } = await supabase.rpc("excluir_campanha_completa", {
    p_campanha_id: campanhaId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
