import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { salvarChaveApi, removerChaveApi, type ProvedorApi } from "@/lib/chaves-api";

const PROVEDORES_VALIDOS = new Set<ProvedorApi>([
  "anthropic", "openai", "google_gemini", "xai_grok", "google_cse",
  "meta_ad_library", "whatsapp_campanha", "whatsapp_denuncias",
]);
const PAPEIS_PERMITIDOS = new Set(["coord_campanha", "candidato"]);

async function autenticar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "não autenticado", status: 401 } as const;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_PERMITIDOS.has(eu.papel)) {
    return { error: "sem permissão", status: 403 } as const;
  }

  return { supabase, user, eu } as const;
}

export async function PUT(request: Request) {
  const auth = await autenticar();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabase, user, eu } = auth;

  const body = await request.json();
  const { provedor, chave, auxiliar } = body as {
    provedor: string;
    chave: string;
    auxiliar?: string;
  };

  if (!provedor || !PROVEDORES_VALIDOS.has(provedor as ProvedorApi)) {
    return NextResponse.json({ error: "provedor inválido" }, { status: 400 });
  }
  if (!chave?.trim()) {
    return NextResponse.json({ error: "chave é obrigatória" }, { status: 400 });
  }

  const { error } = await salvarChaveApi(
    supabase,
    eu.campanha_id,
    provedor as ProvedorApi,
    chave.trim(),
    auxiliar?.trim() ?? null,
    user.id,
  );

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await autenticar();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabase } = auth;

  const body = await request.json();
  const { provedor } = body as { provedor: string };

  if (!provedor || !PROVEDORES_VALIDOS.has(provedor as ProvedorApi)) {
    return NextResponse.json({ error: "provedor inválido" }, { status: 400 });
  }

  const { error } = await removerChaveApi(supabase, provedor as ProvedorApi);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
