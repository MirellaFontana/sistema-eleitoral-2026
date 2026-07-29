export function sanitizarTexto(valor: unknown, maxLen = 5000): string {
  if (typeof valor !== "string") return "";
  return valor.trim().slice(0, maxLen);
}

export function sanitizarTextoOpcional(valor: unknown, maxLen = 5000): string | null {
  if (valor == null || valor === "") return null;
  return sanitizarTexto(valor, maxLen) || null;
}
