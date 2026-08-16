const FUSO = "America/Sao_Paulo";

/** YYYY-MM-DD no fuso de Brasília */
export function hojeBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
}

/** YYYY-MM-DD de N dias atrás no fuso de Brasília */
export function diasAtrasBR(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: FUSO });
}

/** YYYY-MM-DD de N dias à frente no fuso de Brasília */
export function diasFrenteBR(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: FUSO });
}

/** Início do dia de hoje em Brasília como ISO timestamp (para queries timestamptz) */
export function inicioHojeBR(): string {
  return `${hojeBR()}T00:00:00-03:00`;
}

/** Início de N dias atrás em Brasília como ISO timestamp */
export function inicioDiasAtrasBR(n: number): string {
  return `${diasAtrasBR(n)}T00:00:00-03:00`;
}

/** Formata Date para exibição em pt-BR no fuso de Brasília */
export function formatarDataBR(d: Date | string, opcoes?: Intl.DateTimeFormatOptions): string {
  const data = typeof d === "string" ? new Date(d) : d;
  return data.toLocaleDateString("pt-BR", { timeZone: FUSO, ...opcoes });
}
