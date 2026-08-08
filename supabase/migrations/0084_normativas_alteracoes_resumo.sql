-- Coluna para armazenar o resumo de alterações detectadas pelo cron+IA
-- Quando o hash muda, o cron gera um resumo com IA do que mudou.
-- O advogado revisa e clica "Validar" para limpar o resumo e voltar a "validada".
ALTER TABLE fontes_normativas
  ADD COLUMN IF NOT EXISTS alteracoes_resumo TEXT;
