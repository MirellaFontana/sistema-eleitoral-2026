"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function BaixarEvidenciaButton({ path, hash }: { path: string; hash: string }) {
  const supabase = createClient();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleClick() {
    setErro(null);
    setCarregando(true);
    const { data, error } = await supabase.storage
      .from("monitoramento")
      .createSignedUrl(path, 300, { download: `evidencia_${hash.slice(0, 12)}.${extFromPath(path)}` });
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
        className="flex items-center gap-1 text-sm font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-800 disabled:opacity-50"
      >
        <Download size={14} strokeWidth={2} aria-hidden="true" />
        {carregando ? "Gerando…" : "Baixar evidência"}
      </button>
      {erro && <span className="ml-2 text-xs text-red-600">{erro}</span>}
    </span>
  );
}

function extFromPath(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1) : "bin";
}
