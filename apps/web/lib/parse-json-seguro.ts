export function parseJsonSeguro(raw: string): Record<string, unknown> | null {
  let limpo = raw.replace(/```(?:json)?/gi, "").trim();
  const inicio = limpo.indexOf("{");
  if (inicio === -1) return null;
  limpo = limpo.slice(inicio);

  try {
    return JSON.parse(limpo);
  } catch {}

  let profundidade = 0;
  let dentroDeString = false;
  let escape = false;
  let fim = -1;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { dentroDeString = !dentroDeString; continue; }
    if (dentroDeString) continue;
    if (c === "{") profundidade++;
    else if (c === "}") {
      profundidade--;
      if (profundidade === 0) { fim = i; break; }
    }
  }
  if (fim === -1) return null;
  try {
    return JSON.parse(limpo.slice(0, fim + 1));
  } catch {
    return null;
  }
}
