// Território pode ser um bairro específico ou só uma cidade inteira (ex.: cidade pequena com
// uma liderança só, sem necessidade de granularidade de bairro) — nome_bairro é opcional.
export function labelTerritorio(bairro?: string | null, cidade?: string | null): string {
  if (bairro && cidade) return `${bairro} · ${cidade}`;
  if (bairro) return bairro;
  if (cidade) return cidade;
  return "—";
}
