"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
    >
      <LogOut size={14} strokeWidth={2} aria-hidden="true" />
      Sair
    </button>
  );
}
