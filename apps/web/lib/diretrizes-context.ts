import { type SupabaseClient } from "@supabase/supabase-js";
import { type DiretrizCompleta, montarContextoDiretrizes } from "./anthropic";

export async function obterContextoDiretrizes(
  supabase: SupabaseClient,
  campanhaId: string,
): Promise<string> {
  const [{ data: diretriz }, { data: posicoes }] = await Promise.all([
    supabase
      .from("diretrizes_campanha")
      .select("identidade, valores, vocabulario_preferido, vocabulario_proibido, assuntos_sensiveis, limites, mensagens_mae, status")
      .eq("campanha_id", campanhaId)
      .maybeSingle(),
    supabase
      .from("diretrizes_posicoes")
      .select("posicao, evidencias, status, tema_livre, temas_campanha(nome)")
      .eq("campanha_id", campanhaId),
  ]);

  if (!diretriz) return "";

  const completa: DiretrizCompleta = {
    ...diretriz,
    posicoes: (posicoes ?? []).map((p: Record<string, unknown>) => ({
      tema_nome: (p.temas_campanha as { nome: string } | null)?.nome ?? null,
      tema_livre: p.tema_livre as string | null,
      posicao: p.posicao as string,
      evidencias: p.evidencias as string | null,
      status: p.status as string,
    })),
  };

  return montarContextoDiretrizes(completa);
}
