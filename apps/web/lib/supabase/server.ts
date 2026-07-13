import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de servidor (Server Components/Actions). Também sempre chave anon —
// a sessão do usuário logado é o que a RLS usa para filtrar, não um bypass.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de um Server Component sem permissão de escrita de cookie —
            // ok ignorar quando o middleware já cuida do refresh de sessão.
          }
        },
      },
    }
  );
}
