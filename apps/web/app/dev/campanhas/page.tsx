import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDev } from "@/lib/dev";
import { DevCampanhasList } from "./DevCampanhasList";
import { NovaCampanhaForm } from "./NovaCampanhaForm";
import { AdvogadosExternos } from "./AdvogadosExternos";

export default async function DevCampanhasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dev = await isDev(supabase);
  if (!dev) redirect("/");

  const [campanhasRes, internoRes, advogadosRes] = await Promise.all([
    supabase
      .from("campanhas")
      .select("id, nome_candidato, cargo, uf, status, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("usuarios_internos")
      .select("campanha_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("advogados_externos")
      .select("id, email, nome, ativo, created_at")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-8 px-4 py-12">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
          Acesso Dev
        </p>
        <h1 className="text-lg font-semibold">Campanhas</h1>
        <p className="text-sm text-neutral-500">
          Crie campanhas e selecione uma para acessar. Após entrar, convide o
          coordenador em Administração → Usuários.
        </p>
      </div>

      <NovaCampanhaForm />

      <DevCampanhasList
        campanhas={campanhasRes.data ?? []}
        campanhaAtualId={internoRes.data?.campanha_id ?? null}
      />

      <hr className="border-neutral-200" />

      <AdvogadosExternos advogados={advogadosRes.data ?? []} />
    </main>
  );
}
