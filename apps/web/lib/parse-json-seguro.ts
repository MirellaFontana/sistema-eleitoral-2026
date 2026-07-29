function extrairBalanceado(limpo: string, abre: string, fecha: string): string | null {
  const inicio = limpo.indexOf(abre);
  if (inicio === -1) return null;
  const trecho = limpo.slice(inicio);

  try {
    JSON.parse(trecho);
    return trecho;
  } catch {}

  let profundidade = 0;
  let dentroDeString = false;
  let escape = false;
  let fim = -1;
  for (let i = 0; i < trecho.length; i++) {
    const c = trecho[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { dentroDeString = !dentroDeString; continue; }
    if (dentroDeString) continue;
    if (c === abre) profundidade++;
    else if (c === fecha) {
      profundidade--;
      if (profundidade === 0) { fim = i; break; }
    }
  }
  if (fim === -1) return null;
  return trecho.slice(0, fim + 1);
}

export function parseJsonSeguro(raw: string): Record<string, unknown> | null {
  const limpo = raw.replace(/```(?:json)?/gi, "").trim();
  const json = extrairBalanceado(limpo, "{", "}");
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

export function parseJsonArraySeguro(raw: string): unknown[] | null {
  const limpo = raw.replace(/```(?:json)?/gi, "").trim();
  const json = extrairBalanceado(limpo, "[", "]");
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}
