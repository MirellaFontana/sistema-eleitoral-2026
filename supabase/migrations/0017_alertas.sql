-- Módulo 3 — Jurídico parte 3: Matriz de alertas + encaminhamento (ref. .pipeline/specs.md
-- [2026-07-16] "Módulo 3 — Jurídico parte 3"). Fecha o bloco jurídico da Camada 3.

CREATE TYPE status_envio_alerta AS ENUM ('pendente_configuracao', 'enviado', 'falhou');
CREATE TYPE canal_alerta AS ENUM ('whatsapp', 'app');

-- Telefone: precisa pra saber pra onde mandar o WhatsApp quando o envio real for ligado
-- (dependência bloqueante — provedor ainda não definido, ver specs.md).
ALTER TABLE usuarios_internos ADD COLUMN telefone TEXT;

CREATE TABLE alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    monitoramento_item_id UUID NOT NULL REFERENCES monitoramento_itens(id),
    destinatario_papel papel_usuario NOT NULL,
    canal canal_alerta NOT NULL DEFAULT 'whatsapp',
    status_envio status_envio_alerta NOT NULL DEFAULT 'pendente_configuracao',
    erro_envio TEXT,
    lido_em TIMESTAMPTZ,
    encaminhado_por UUID REFERENCES usuarios_internos(id),
    encaminhado_em TIMESTAMPTZ,
    encaminhado_nota TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT encaminhamento_coerente CHECK (
        (encaminhado_em IS NULL AND encaminhado_por IS NULL) OR
        (encaminhado_em IS NOT NULL AND encaminhado_por IS NOT NULL)
    )
);
CREATE INDEX idx_alertas_campanha ON alertas (campanha_id);
CREATE INDEX idx_alertas_item ON alertas (monitoramento_item_id);

-- Gatilho automático: categoria de ameaça + gravidade alta gera 1 alerta por papel destinatário
-- fixo (advogado_responsavel, coord_campanha) — sem matriz configurável nesta entrega.
-- Só grava a fila no banco; o envio HTTP de verdade roda na aplicação (Route Handler), não aqui
-- — mesmo padrão de "IA roda na aplicação" já usado no Módulo 4 (Postgres não faz chamada externa).
CREATE OR REPLACE FUNCTION gerar_alertas_ameaca_grave()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.categoria IN ('ameaca_juridica', 'deepfake_suspeito', 'gestao_crise') AND NEW.gravidade = 'alta' THEN
        INSERT INTO alertas (campanha_id, monitoramento_item_id, destinatario_papel)
        VALUES
            (NEW.campanha_id, NEW.id, 'advogado_responsavel'),
            (NEW.campanha_id, NEW.id, 'coord_campanha');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerar_alertas_ameaca_grave
    AFTER INSERT ON monitoramento_itens
    FOR EACH ROW EXECUTE FUNCTION gerar_alertas_ameaca_grave();

ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas FORCE ROW LEVEL SECURITY;

-- Leitura liberada a todos os papéis internos (mesmo padrão de monitoramento_itens).
CREATE POLICY alertas_select ON alertas
    FOR SELECT USING (campanha_id = current_campanha_id());

-- "Marcar como lido": qualquer papel interno pode atualizar lido_em, mas não os campos de
-- encaminhamento (isso é travado na policy de UPDATE de encaminhamento, mais estrita, abaixo,
-- via WITH CHECK combinado com trigger de coerência dos campos protegidos).
CREATE POLICY alertas_update_lido ON alertas
    FOR UPDATE
    USING (campanha_id = current_campanha_id())
    WITH CHECK (campanha_id = current_campanha_id());

-- Só advogado_responsavel marca/edita o encaminhamento — reforçado por trigger, não só RLS,
-- porque RLS de UPDATE não distingue quais colunas mudaram dentro do mesmo comando.
CREATE OR REPLACE FUNCTION restringir_encaminhamento_alertas()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.encaminhado_em IS DISTINCT FROM OLD.encaminhado_em
        OR NEW.encaminhado_por IS DISTINCT FROM OLD.encaminhado_por
        OR NEW.encaminhado_nota IS DISTINCT FROM OLD.encaminhado_nota)
       AND current_papel() <> 'advogado_responsavel'
    THEN
        RAISE EXCEPTION 'Só o advogado responsável marca encaminhamento à Justiça Eleitoral';
    END IF;
    -- Ninguém assina encaminhamento em nome de outro usuário.
    IF NEW.encaminhado_por IS DISTINCT FROM OLD.encaminhado_por AND NEW.encaminhado_por IS NOT NULL
       AND NEW.encaminhado_por <> auth.uid()
    THEN
        RAISE EXCEPTION 'encaminhado_por deve ser o usuário autenticado atual';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alertas_restringir_encaminhamento
    BEFORE UPDATE ON alertas
    FOR EACH ROW EXECUTE FUNCTION restringir_encaminhamento_alertas();

GRANT SELECT, UPDATE ON alertas TO authenticated;
REVOKE ALL ON alertas FROM anon;
