import { describe, it, expect } from "vitest";
import { isErroDeAcesso } from "./ia-client";

describe("isErroDeAcesso", () => {
  it("detecta permission denied", () => {
    expect(isErroDeAcesso(new Error("Permission denied for this key"))).toBe(true);
  });

  it("detecta 401", () => {
    expect(isErroDeAcesso(new Error("Request failed with status 401"))).toBe(true);
  });

  it("detecta 403", () => {
    expect(isErroDeAcesso(new Error("403 Forbidden"))).toBe(true);
  });

  it("detecta quota exceeded", () => {
    expect(isErroDeAcesso(new Error("Quota exceeded"))).toBe(true);
  });

  it("detecta disabled organization", () => {
    expect(isErroDeAcesso(new Error("Organization is disabled"))).toBe(true);
  });

  it("detecta invalid API key", () => {
    expect(isErroDeAcesso(new Error("Invalid API key provided"))).toBe(true);
  });

  it("não detecta erro genérico", () => {
    expect(isErroDeAcesso(new Error("Network timeout"))).toBe(false);
  });

  it("não detecta string pura", () => {
    expect(isErroDeAcesso("permission denied")).toBe(false);
  });

  it("não detecta null", () => {
    expect(isErroDeAcesso(null)).toBe(false);
  });

  it("não detecta undefined", () => {
    expect(isErroDeAcesso(undefined)).toBe(false);
  });
});
