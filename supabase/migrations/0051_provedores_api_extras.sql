-- Expandir provedores de API: IA (OpenAI, Gemini), WhatsApp, Meta Ad Library.

ALTER TYPE provedor_api ADD VALUE IF NOT EXISTS 'openai';
ALTER TYPE provedor_api ADD VALUE IF NOT EXISTS 'google_gemini';
ALTER TYPE provedor_api ADD VALUE IF NOT EXISTS 'whatsapp_denuncias';
ALTER TYPE provedor_api ADD VALUE IF NOT EXISTS 'whatsapp_campanha';
ALTER TYPE provedor_api ADD VALUE IF NOT EXISTS 'meta_ad_library';
