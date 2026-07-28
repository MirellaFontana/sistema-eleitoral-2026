import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: fontes } = await supabase
    .from("fontes_normativas")
    .select("id, url_oficial, hash_conteudo, titulo, status")
    .not("url_oficial", "is", null)
    .in("status", ["validada", "pendente"]);

  if (!fontes || fontes.length === 0) {
    return NextResponse.json({ message: "nenhuma fonte normativa com URL para verificar" });
  }

  const resultados: { id: string; titulo: string; mudou: boolean; erro?: string }[] = [];

  for (const f of fontes) {
    try {
      const res = await fetch(f.url_oficial!, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        resultados.push({ id: f.id, titulo: f.titulo, mudou: false, erro: `HTTP ${res.status}` });
        continue;
      }

      const texto = await res.text();
      const encoder = new TextEncoder();
      const data = encoder.encode(texto);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const novoHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const mudou = f.hash_conteudo !== null && f.hash_conteudo !== novoHash;

      const updates: Record<string, unknown> = {
        data_verificacao: new Date().toISOString().slice(0, 10),
        hash_conteudo: novoHash,
        updated_at: new Date().toISOString(),
      };

      if (mudou) {
        updates.status = "desatualizada";
      }

      await supabase
        .from("fontes_normativas")
        .update(updates)
        .eq("id", f.id);

      resultados.push({ id: f.id, titulo: f.titulo, mudou });
    } catch (e) {
      resultados.push({ id: f.id, titulo: f.titulo, mudou: false, erro: String(e) });
    }
  }

  const alteradas = resultados.filter((r) => r.mudou).length;
  return NextResponse.json({ verificadas: resultados.length, alteradas, resultados });
}
