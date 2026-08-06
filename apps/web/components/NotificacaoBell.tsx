"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function NotificacaoBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("usuarios_internos")
        .select("papel")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data?.papel) return;
          supabase
            .from("alertas")
            .select("*", { count: "exact", head: true })
            .eq("destinatario_papel", data.papel)
            .is("lido_em", null)
            .then(({ count: c }) => setCount(c ?? 0));
        });
    });
  }, []);

  return (
    <Link
      href="/dashboard#alertas"
      className="relative rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
      title="Notificações"
    >
      <Bell size={18} strokeWidth={2} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
