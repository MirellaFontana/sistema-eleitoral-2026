import { type SupabaseClient } from "@supabase/supabase-js";

export async function isDev(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("is_dev_plataforma");
  return data === true;
}

export async function listarCampanhas(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("campanhas")
    .select("id, nome_candidato, cargo, uf, status")
    .order("created_at", { ascending: false });
  return data ?? [];
}
