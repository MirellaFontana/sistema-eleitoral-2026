import { describe, it, expect } from "vitest";
import { papelExigeMfa } from "./mfa";

describe("papelExigeMfa", () => {
  it("exige MFA para coord_campanha", () => {
    expect(papelExigeMfa("coord_campanha")).toBe(true);
  });

  it("exige MFA para candidato", () => {
    expect(papelExigeMfa("candidato")).toBe(true);
  });

  it("não exige MFA para apoio_campanha", () => {
    expect(papelExigeMfa("apoio_campanha")).toBe(false);
  });

  it("não exige MFA para redator_marketing", () => {
    expect(papelExigeMfa("redator_marketing")).toBe(false);
  });

  it("não exige MFA para string vazia", () => {
    expect(papelExigeMfa("")).toBe(false);
  });
});
