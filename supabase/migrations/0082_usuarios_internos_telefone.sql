ALTER TABLE usuarios_internos ADD COLUMN telefone TEXT;
COMMENT ON COLUMN usuarios_internos.telefone IS 'Número WhatsApp no formato E.164 (+5581999...)';
