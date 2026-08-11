import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdvExterno } from "@/lib/dev";

export default async function AdvEntrarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campanhaId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adv = await isAdvExterno(supabase);
  if (!adv) redirect("/");

  const { data: campanha } = await supabase
    .from("campanhas")
    .select("id")
    .eq("id", campanhaId)
    .eq("criado_por", user.id)
    .maybeSingle();

  if (!campanha) redirect("/adv/clientes");

  const { data: existente } = await supabase
    .from("usuarios_internos")
    .select("id, campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existente) {
    if (existente.campanha_id !== campanhaId) {
      await supabase
        .from("usuarios_internos")
        .update({ campanha_id: campanhaId })
        .eq("id", user.id);
    }
  } else {
    await supabase.from("usuarios_internos").insert({
      id: user.id,
      campanha_id: campanhaId,
      papel: "advogado_responsavel",
      nome: "Advogado",
      telefone: "0000000000",
    });
  }

  redirect("/juridico/processos");
}
