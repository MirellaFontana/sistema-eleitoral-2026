import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDev } from "@/lib/dev";

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
  redirect(dev ? "/dev/campanhas" : "/onboarding");
}
