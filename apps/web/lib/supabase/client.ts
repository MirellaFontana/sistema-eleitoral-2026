import { createBrowserClient } from "@supabase/ssr";

// Cliente do navegador. Usa sempre a chave anon — nunca service_role aqui.
// A proteção real dos dados é a RLS testada no Módulo 1, não este arquivo.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
