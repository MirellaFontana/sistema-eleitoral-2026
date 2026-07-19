"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MetaDeleteButton({ metaId }: { metaId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [confirmando, setConfirmando] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleDelete() {
    setCarregando(true);
    await supabase.from("metas").delete().eq("id", metaId);
    setCarregando(false);
    setConfirmando(false);
    router.refresh();
  }

  if (!confirmando) {
    return (
      <button
        onClick={() => setConfirmando(true)}
        title="Excluir meta"
        className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        🗑️
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        onClick={handleDelete}
        disabled={carregando}
        className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {carregando ? "…" : "Excluir"}
      </button>
      <button
        onClick={() => setConfirmando(false)}
        className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100"
      >
        Cancelar
      </button>
    </span>
  );
}
