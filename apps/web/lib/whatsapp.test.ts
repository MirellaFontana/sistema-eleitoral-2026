import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarWhatsApp, normalizarTelefoneBR } from "./whatsapp";

describe("normalizarTelefoneBR", () => {
  it("adiciona DDI 55 a número com DDD", () => {
    expect(normalizarTelefoneBR("(41) 99876-5432")).toBe("5541998765432");
    expect(normalizarTelefoneBR("41 3222-1234")).toBe("554132221234");
  });

  it("mantém número que já tem DDI", () => {
    expect(normalizarTelefoneBR("+55 41 99876-5432")).toBe("5541998765432");
    expect(normalizarTelefoneBR("554132221234")).toBe("554132221234");
  });

  it("remove zeros à esquerda (0DD)", () => {
    expect(normalizarTelefoneBR("041 99876-5432")).toBe("5541998765432");
  });

  it("rejeita números curtos ou lixo", () => {
    expect(normalizarTelefoneBR("12345")).toBeNull();
    expect(normalizarTelefoneBR("")).toBeNull();
    expect(normalizarTelefoneBR("telefone")).toBeNull();
  });
});

describe("enviarWhatsApp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("falha com erro claro quando não configurado", async () => {
    vi.stubEnv("WHATSAPP_API_TOKEN", "");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
    const r = await enviarWhatsApp("41999999999", "oi");
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/não configurado/);
  });

  it("falha com telefone inválido sem chamar a API", async () => {
    vi.stubEnv("WHATSAPP_API_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await enviarWhatsApp("123", "oi");
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/inválido/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("envia com payload correto quando configurado", async () => {
    vi.stubEnv("WHATSAPP_API_TOKEN", "token-abc");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "999");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.X" }] }), { status: 200 }));

    const r = await enviarWhatsApp("(41) 99876-5432", "olá eleitor");
    expect(r.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://graph.facebook.com/v21.0/999/messages");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: "5541998765432",
      type: "text",
      text: { body: "olá eleitor" },
    });
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-abc");
  });

  it("reporta erro da API sem lançar", async () => {
    vi.stubEnv("WHATSAPP_API_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "999");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Invalid OAuth access token" } }), { status: 401 }),
    );
    const r = await enviarWhatsApp("41999999999", "oi");
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/Invalid OAuth/);
  });
});
