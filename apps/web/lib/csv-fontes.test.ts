import { describe, expect, it } from "vitest";
import { interpretarCsvFontes, limparDominio, normalizarTier, parseCsv } from "./csv-fontes";

describe("parseCsv", () => {
  it("detecta separador ; (Excel BR) e ,", () => {
    expect(parseCsv("a;b;c")).toEqual([["a", "b", "c"]]);
    expect(parseCsv("a,b,c")).toEqual([["a", "b", "c"]]);
  });

  it("respeita aspas com separador dentro", () => {
    expect(parseCsv('"Foz, Oeste";site.com')).toEqual([["Foz, Oeste", "site.com"]]);
    expect(parseCsv('"diz ""oi""";x')).toEqual([['diz "oi"', "x"]]);
  });

  it("ignora linhas vazias", () => {
    expect(parseCsv("a;b\n\n\nc;d\n")).toHaveLength(2);
  });
});

describe("limparDominio", () => {
  it("remove protocolo, www e barra final", () => {
    expect(limparDominio("https://www.site.com.br/")).toBe("site.com.br");
    expect(limparDominio("http://site.com")).toBe("site.com");
    expect(limparDominio("  site.com.br  ")).toBe("site.com.br");
  });
});

describe("normalizarTier", () => {
  it("aceita valores do enum e nomes amigáveis", () => {
    expect(normalizarTier("tier1_megafone")).toBe("tier1_megafone");
    expect(normalizarTier("Megafone")).toBe("tier1_megafone");
    expect(normalizarTier("política")).toBe("tier1_politica");
    expect(normalizarTier("CBN")).toBe("tier1_cbn");
    expect(normalizarTier("rádio")).toBe("tier1_cbn");
  });

  it("cai em tier2_regional por padrão", () => {
    expect(normalizarTier("")).toBe("tier2_regional");
    expect(normalizarTier("qualquer coisa")).toBe("tier2_regional");
  });
});

describe("interpretarCsvFontes", () => {
  it("lê arquivo com cabeçalho em qualquer ordem de colunas", () => {
    const csv = "nome;regiao;dominio;tier\nPortal X;Curitiba;portalx.com.br;megafone";
    expect(interpretarCsvFontes(csv)).toEqual([
      { dominio: "portalx.com.br", nome: "Portal X", tier: "tier1_megafone", regiao: "Curitiba" },
    ]);
  });

  it("lê arquivo sem cabeçalho na ordem padrão", () => {
    const csv = "site.com.br;Site;cbn;Litoral";
    expect(interpretarCsvFontes(csv)).toEqual([
      { dominio: "site.com.br", nome: "Site", tier: "tier1_cbn", regiao: "Litoral" },
    ]);
  });

  it("usa domínio como nome quando nome falta e null quando região falta", () => {
    const csv = "dominio\nsite.com.br";
    expect(interpretarCsvFontes(csv)).toEqual([
      { dominio: "site.com.br", nome: "site.com.br", tier: "tier2_regional", regiao: null },
    ]);
  });

  it("descarta linhas sem domínio válido e duplicatas", () => {
    const csv = "dominio;nome\nsem-ponto;X\nsite.com;A\nsite.com;B\nhttps://site.com/;C";
    const r = interpretarCsvFontes(csv);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("A");
  });

  it("devolve vazio para arquivo vazio", () => {
    expect(interpretarCsvFontes("")).toEqual([]);
  });
});
