"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function VerCapturaButton({ path }: { path: string }) {
  const supabase = createClient();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleClick() {
    setErro(null);
    setCarregando(true);
    const { data, error } = await supabase.storage.from("monitoramento").createSignedUrl(path, 60);
    setCarregando(false);

    if (error || !data) {
      setErro(error?.message ?? "erro ao gerar link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <span>
      <button
        onClick={handleClick}
        disabled={carregando}
        className="text-sm text-neutral-900 underline underline-offset-2 disabled:opacity-50"
      >
        {carregando ? "Gerando link…" : "Ver captura"}
      </button>
      {erro && <span className="ml-2 text-xs text-red-600">{erro}</span>}
    </span>
  );
}
