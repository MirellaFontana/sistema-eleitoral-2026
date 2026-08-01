// Envio real por WhatsApp via Meta Cloud API.
// Requer WHATSAPP_API_TOKEN (token permanente do app Meta) e
// WHATSAPP_PHONE_NUMBER_ID (id do número no WhatsApp Business).

export function normalizarTelefoneBR(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, "").replace(/^0+/, "");
  if (digitos.length < 10) return null;
  // Já tem DDI 55 (12-13 dígitos: 55 + DDD + 8/9 dígitos)
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    return digitos;
  }
  // DDD + número (10-11 dígitos)
  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }
  return null;
}

export async function enviarWhatsApp(
  telefone: string,
  conteudo: string,
): Promise<{ ok: boolean; erro?: string }> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return {
      ok: false,
      erro: "Provedor de WhatsApp não configurado (WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID ausentes).",
    };
  }

  const numero = normalizarTelefoneBR(telefone);
  if (!numero) {
    return { ok: false, erro: `Telefone inválido: "${telefone}"` };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: numero,
        type: "text",
        text: { body: conteudo },
      }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      return { ok: false, erro: `Meta Cloud API: ${msg}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "falha de rede ao chamar a Meta Cloud API" };
  }
}
