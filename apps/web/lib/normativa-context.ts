import type { SupabaseClient } from "@supabase/supabase-js";

export async function obterContextoNormativo(
  supabase: SupabaseClient,
  campanhaId: string,
): Promise<string> {
  const { data: fontes } = await supabase
    .from("fontes_normativas")
    .select("titulo, tipo, numero, ano, autoridade, status, dispositivos_normativos(artigo, paragrafo, inciso, texto, tema, status)")
    .eq("campanha_id", campanhaId)
    .in("status", ["validada", "pendente"])
    .order("tipo")
    .limit(20);

  if (!fontes || fontes.length === 0) return "";

  const linhas = fontes.map((f) => {
    const ref = [f.tipo, f.numero, f.ano ? `/${f.ano}` : ""].filter(Boolean).join(" ");
    const header = `${ref} — ${f.titulo} [${f.autoridade}] (${f.status})`;
    const dispositivos = Array.isArray(f.dispositivos_normativos) ? f.dispositivos_normativos : [];
    const disp = dispositivos
      .map((d) => {
        const loc = [d.artigo ? `Art. ${d.artigo}` : null, d.paragrafo ? `§${d.paragrafo}` : null, d.inciso ? `Inc. ${d.inciso}` : null]
          .filter(Boolean)
          .join(", ");
        return `  - ${loc || "(sem referência)"}: ${(d.texto ?? "").slice(0, 300)} [${d.status}]${d.tema ? ` (tema: ${d.tema})` : ""}`;
      })
      .join("\n");
    return disp ? `${header}\n${disp}` : header;
  });

  return `BASE NORMATIVA ELEITORAL:\n${linhas.join("\n\n")}`;
}
