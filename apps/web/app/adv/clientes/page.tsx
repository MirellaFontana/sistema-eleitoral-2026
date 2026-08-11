import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdvExterno } from "@/lib/dev";
import { AdvClientes } from "./AdvClientes";

export default async function AdvClientesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adv = await isAdvExterno(supabase);
  if (!adv) redirect("/");

  const { data: campanhas } = await supabase
    .from("campanhas")
    .select("id, nome_candidato, cargo, uf, status, created_at")
    .eq("criado_por", user.id)
    .order("created_at", { ascending: false });

  const { data: minhaInterno } = await supabase
    .from("usuarios_internos")
    .select("campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 px-4 py-12">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-teal-600">
          Módulo Jurídico
        </p>
        <h1 className="text-lg font-semibold">Meus Clientes</h1>
        <p className="text-sm text-neutral-500">
          Cadastre campanhas-cliente e selecione uma para gerenciar processos e prazos.
        </p>
      </div>

      <AdvClientes
        campanhas={campanhas ?? []}
        campanhaAtualId={minhaInterno?.campanha_id ?? null}
      />
    </main>
  );
}
