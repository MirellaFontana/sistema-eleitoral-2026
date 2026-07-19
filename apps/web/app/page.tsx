import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  redirect(usuarioInterno ? "/dashboard" : "/onboarding");
}
