import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
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

  // Já tem campanha — onboarding só acontece uma vez.
  if (usuarioInterno) redirect("/usuarios");

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-10">
      <OnboardingForm />
    </main>
  );
}
