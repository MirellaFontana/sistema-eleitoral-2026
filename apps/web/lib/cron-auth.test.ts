import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verificarCronAuth } from "./cron-auth";

function fakeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return { headers } as unknown as Request;
}

describe("verificarCronAuth", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("retorna 401 quando CRON_SECRET não está definido", () => {
    delete process.env.CRON_SECRET;
    const res = verificarCronAuth(fakeRequest("Bearer qualquer"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("retorna 401 quando header não é enviado", () => {
    process.env.CRON_SECRET = "segredo";
    const res = verificarCronAuth(fakeRequest());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("retorna 401 quando token é errado", () => {
    process.env.CRON_SECRET = "segredo";
    const res = verificarCronAuth(fakeRequest("Bearer errado"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("retorna null quando token é correto", () => {
    process.env.CRON_SECRET = "segredo";
    const res = verificarCronAuth(fakeRequest("Bearer segredo"));
    expect(res).toBeNull();
  });

  it("rejeita Bearer sem espaço", () => {
    process.env.CRON_SECRET = "segredo";
    const res = verificarCronAuth(fakeRequest("Bearersegredo"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });
});
