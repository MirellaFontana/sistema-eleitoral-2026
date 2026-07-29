import { describe, it, expect } from "vitest";
import { labelTerritorio } from "./territorio";

describe("labelTerritorio", () => {
  it("combina bairro e cidade", () => {
    expect(labelTerritorio("Centro", "Curitiba")).toBe("Centro · Curitiba");
  });

  it("retorna só bairro quando cidade é null", () => {
    expect(labelTerritorio("Centro", null)).toBe("Centro");
  });

  it("retorna só cidade quando bairro é null", () => {
    expect(labelTerritorio(null, "Curitiba")).toBe("Curitiba");
  });

  it("retorna traço quando ambos são null", () => {
    expect(labelTerritorio(null, null)).toBe("—");
  });

  it("trata undefined como ausente", () => {
    expect(labelTerritorio(undefined, undefined)).toBe("—");
    expect(labelTerritorio(undefined, "SP")).toBe("SP");
  });
});
