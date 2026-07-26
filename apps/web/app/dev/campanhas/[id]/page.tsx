import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDev } from "@/lib/dev";

export default async function DevEntrarCampanhaPage({
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

  const dev = await isDev(supabase);
  if (!dev) redirect("/");

  const { data: campanha } = await supabase
    .from("campanhas")
    .select("id, nome_candidato")
    .eq("id", campanhaId)
    .maybeSingle();

  if (!campanha) redirect("/dev/campanhas");

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
      papel: "coord_campanha",
      nome: "Dev Plataforma",
      telefone: "0000000000",
    });
  }

  redirect("/dashboard");
}
