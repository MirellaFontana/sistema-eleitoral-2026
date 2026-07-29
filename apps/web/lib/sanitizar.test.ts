import { describe, it, expect } from "vitest";
import { sanitizarTexto, sanitizarTextoOpcional } from "./sanitizar";

describe("sanitizarTexto", () => {
  it("trims whitespace", () => {
    expect(sanitizarTexto("  hello  ")).toBe("hello");
  });

  it("truncates at maxLen", () => {
    expect(sanitizarTexto("abcdef", 3)).toBe("abc");
  });

  it("returns empty string for non-string", () => {
    expect(sanitizarTexto(123)).toBe("");
    expect(sanitizarTexto(null)).toBe("");
    expect(sanitizarTexto(undefined)).toBe("");
  });
});

describe("sanitizarTextoOpcional", () => {
  it("returns null for empty string", () => {
    expect(sanitizarTextoOpcional("")).toBeNull();
    expect(sanitizarTextoOpcional("   ")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(sanitizarTextoOpcional(null)).toBeNull();
    expect(sanitizarTextoOpcional(undefined)).toBeNull();
  });

  it("returns trimmed string", () => {
    expect(sanitizarTextoOpcional("  hello  ")).toBe("hello");
  });
});
