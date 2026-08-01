// Parse de planilha CSV de fontes de monitoramento (exportada do Excel/Sheets).
// Aceita separador , ou ; e campos entre aspas.

export function normalizarTier(valor: string): string {
  const v = valor.trim().toLowerCase();
  if (["tier1_megafone", "tier1_politica", "tier1_cbn", "tier2_regional"].includes(v)) return v;
  if (v.includes("megafone")) return "tier1_megafone";
  if (v.includes("polít") || v.includes("polit")) return "tier1_politica";
  if (v.includes("cbn") || v.includes("rádio") || v.includes("radio")) return "tier1_cbn";
  return "tier2_regional";
}

export function limparDominio(valor: string): string {
  return valor
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function parseCsv(texto: string): string[][] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length === 0) return [];
  // Conta separadores fora de aspas para não ser enganado por "Foz, Oeste"
  const foraAspas = linhas[0].replace(/"[^"]*"/g, "");
  const sep = (foraAspas.match(/;/g)?.length ?? 0) >= (foraAspas.match(/,/g)?.length ?? 0) &&
    foraAspas.includes(";")
      ? ";"
      : ",";
  return linhas.map((linha) => {
    const campos: string[] = [];
    let atual = "";
    let dentroAspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (dentroAspas && linha[i + 1] === '"') { atual += '"'; i++; }
        else dentroAspas = !dentroAspas;
      } else if (c === sep && !dentroAspas) {
        campos.push(atual);
        atual = "";
      } else {
        atual += c;
      }
    }
    campos.push(atual);
    return campos.map((c) => c.trim());
  });
}

export type FonteImportada = {
  dominio: string;
  nome: string;
  tier: string;
  regiao: string | null;
};

// Interpreta as linhas do CSV: detecta cabeçalho (dominio/site/url, nome, tier, regiao)
// ou assume a ordem dominio;nome;tier;regiao. Linhas sem domínio válido são descartadas,
// duplicatas dentro do arquivo também.
export function interpretarCsvFontes(texto: string): FonteImportada[] {
  const linhas = parseCsv(texto);
  if (linhas.length === 0) return [];

  const cab = linhas[0].map((c) => c.toLowerCase());
  // Cabeçalho: tem palavra-chave conhecida E nenhuma célula com ponto (domínio é dado, não título)
  const temCabecalho =
    cab.some((c) =>
      ["dominio", "domínio", "site", "url", "nome", "tier", "regiao", "região"].includes(c),
    ) && !cab.some((c) => c.includes("."));
  const idx = {
    dominio: temCabecalho
      ? cab.findIndex((c) => ["dominio", "domínio", "site", "url"].includes(c))
      : 0,
    nome: temCabecalho ? cab.findIndex((c) => ["nome", "veiculo", "veículo"].includes(c)) : 1,
    tier: temCabecalho ? cab.findIndex((c) => ["tier", "tipo", "categoria"].includes(c)) : 2,
    regiao: temCabecalho
      ? cab.findIndex((c) => ["regiao", "região", "local", "cidade"].includes(c))
      : 3,
  };
  if (idx.dominio < 0) return [];

  const vistos = new Set<string>();
  const resultado: FonteImportada[] = [];
  for (const l of temCabecalho ? linhas.slice(1) : linhas) {
    const dominio = limparDominio(l[idx.dominio] ?? "");
    if (!dominio || !dominio.includes(".") || vistos.has(dominio)) continue;
    vistos.add(dominio);
    resultado.push({
      dominio,
      nome: (idx.nome >= 0 && l[idx.nome]) || dominio,
      tier: normalizarTier(idx.tier >= 0 ? (l[idx.tier] ?? "") : ""),
      regiao: (idx.regiao >= 0 && l[idx.regiao]) || null,
    });
  }
  return resultado;
}
