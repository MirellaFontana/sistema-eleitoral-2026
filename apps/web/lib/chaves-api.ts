import { type SupabaseClient } from "@supabase/supabase-js";

export type ProvedorApi =
  | "anthropic"
  | "openai"
  | "google_gemini"
  | "xai_grok"
  | "google_cse"
  | "meta_ad_library"
  | "whatsapp_campanha"
  | "whatsapp_denuncias";

const ENCRYPTION_KEY = process.env.API_ENCRYPTION_KEY ?? "";

export async function obterChaveApi(
  supabase: SupabaseClient,
  provedor: ProvedorApi,
): Promise<string | null> {
  if (!ENCRYPTION_KEY) return null;

  const { data } = await supabase
    .from("chaves_api")
    .select("chave_cifrada")
    .eq("provedor", provedor)
    .eq("ativo", true)
    .maybeSingle();

  if (!data?.chave_cifrada) return null;

  const { data: decifrada } = await supabase.rpc("decifrar_chave_api", {
    cifrada: data.chave_cifrada,
    senha: ENCRYPTION_KEY,
  });

  return decifrada ?? null;
}

export async function salvarChaveApi(
  supabase: SupabaseClient,
  campanhaId: string,
  provedor: ProvedorApi,
  chave: string,
  auxiliar: string | null,
  userId: string,
): Promise<{ error: string | null }> {
  if (!ENCRYPTION_KEY) return { error: "API_ENCRYPTION_KEY não configurada no servidor" };

  const { data: cifrada } = await supabase.rpc("cifrar_chave_api", {
    valor: chave,
    senha: ENCRYPTION_KEY,
  });

  if (!cifrada) return { error: "Falha ao cifrar a chave" };

  const { error } = await supabase
    .from("chaves_api")
    .upsert(
      {
        campanha_id: campanhaId,
        provedor,
        chave_cifrada: cifrada,
        auxiliar: auxiliar || null,
        ativo: true,
        atualizado_por: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campanha_id,provedor" },
    );

  return { error: error?.message ?? null };
}

export async function removerChaveApi(
  supabase: SupabaseClient,
  provedor: ProvedorApi,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("chaves_api")
    .delete()
    .eq("provedor", provedor);

  return { error: error?.message ?? null };
}
