import type { SupabaseClient } from "@supabase/supabase-js";

const PAPEIS_COM_MFA_OBRIGATORIO = new Set<string>([]);

export function papelExigeMfa(papel: string) {
  return PAPEIS_COM_MFA_OBRIGATORIO.has(papel);
}

/**
 * Decide para onde mandar o usuário antes de renderizar uma tela cuja ação depende de
 * mfa_verificado() no banco (ex.: convidar usuário, editar campanha). Não substitui a RLS —
 * só evita que o usuário chegue numa tela pra descobrir o bloqueio ao tentar salvar.
 */
export async function proximaRotaMfa(
  supabase: SupabaseClient,
  papel: string
): Promise<"/mfa/enroll" | "/mfa/verify" | null> {
  if (!papelExigeMfa(papel)) return null;

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return null;

  if (data.currentLevel === "aal2") return null;
  if (data.nextLevel === "aal2") return "/mfa/verify"; // fator existe, sessão precisa subir
  return "/mfa/enroll"; // nenhum fator verificado ainda
}
