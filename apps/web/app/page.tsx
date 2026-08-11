import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDev, isAdvExterno } from "@/lib/dev";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: usuarioInterno } = await supabase
    .from("usuarios_internos")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (usuarioInterno) redirect("/dashboard");

  const dev = await isDev(supabase);
  if (dev) redirect("/dev/campanhas");

  const adv = await isAdvExterno(supabase);
  if (adv) redirect("/adv/clientes");

  redirect("/onboarding");
}
