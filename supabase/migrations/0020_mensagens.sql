-- Cadastro de mensagens: envio individual ligado a destinatário já cadastrado
-- (ref. .pipeline/specs.md [2026-07-16] "Cadastro de mensagens").
-- Uma linha = uma mensagem = um destinatário. Não existe campo de lista/array de destinatários
-- nem seleção múltipla na tela — é a trava estrutural contra disparo em massa (Regra de Ouro
-- já existente no CLAUDE.md), não só uma política de uso.

CREATE TYPE tipo_destinatario_mensagem AS ENUM ('cidadao', 'apoiador', 'lideranca');
CREATE TYPE canal_mensagem AS ENUM ('whatsapp', 'outro');
CREATE TYPE status_mensagem AS ENUM ('pendente_configuracao', 'enviada', 'falhou');

CREATE TABLE mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    tipo_destinatario tipo_destinatario_mensagem NOT NULL,
    cidadao_id UUID REFERENCES cidadaos(id),
    apoiador_id UUID REFERENCES apoiadores(id),
    lideranca_id UUID REFERENCES liderancas(id),
    canal canal_mensagem NOT NULL DEFAULT 'whatsapp',
    conteudo TEXT NOT NULL,
    status status_mensagem NOT NULL DEFAULT 'pendente_configuracao',
    erro_envio TEXT,
    enviado_em TIMESTAMPTZ,
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT destinatario_coerente CHECK (
        (tipo_destinatario = 'cidadao' AND cidadao_id IS NOT NULL AND apoiador_id IS NULL AND lideranca_id IS NULL) OR
        (tipo_destinatario = 'apoiador' AND apoiador_id IS NOT NULL AND cidadao_id IS NULL AND lideranca_id IS NULL) OR
        (tipo_destinatario = 'lideranca' AND lideranca_id IS NOT NULL AND cidadao_id IS NULL AND apoiador_id IS NULL)
    )
);
CREATE INDEX idx_mensagens_campanha ON mensagens (campanha_id);
CREATE INDEX idx_mensagens_cidadao ON mensagens (cidadao_id);
CREATE INDEX idx_mensagens_apoiador ON mensagens (apoiador_id);
CREATE INDEX idx_mensagens_lideranca ON mensagens (lideranca_id);

-- Defesa em profundidade: destinatário (seja qual for) precisa pertencer à mesma campanha da
-- mensagem — mesmo padrão de apoiadores.cidadao_id (migration 0019).
CREATE OR REPLACE FUNCTION checar_destinatario_mesma_campanha_mensagem()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.tipo_destinatario = 'cidadao' AND NOT EXISTS (
        SELECT 1 FROM cidadaos c WHERE c.id = NEW.cidadao_id AND c.campanha_id = NEW.campanha_id
    ) THEN
        RAISE EXCEPTION 'destinatário (cidadão) precisa pertencer à mesma campanha da mensagem';
    END IF;
    IF NEW.tipo_destinatario = 'apoiador' AND NOT EXISTS (
        SELECT 1 FROM apoiadores a WHERE a.id = NEW.apoiador_id AND a.campanha_id = NEW.campanha_id
    ) THEN
        RAISE EXCEPTION 'destinatário (apoiador) precisa pertencer à mesma campanha da mensagem';
    END IF;
    IF NEW.tipo_destinatario = 'lideranca' AND NOT EXISTS (
        SELECT 1 FROM liderancas l WHERE l.id = NEW.lideranca_id AND l.campanha_id = NEW.campanha_id
    ) THEN
        RAISE EXCEPTION 'destinatário (liderança) precisa pertencer à mesma campanha da mensagem';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mensagens_checar_destinatario
    BEFORE INSERT ON mensagens
    FOR EACH ROW EXECUTE FUNCTION checar_destinatario_mesma_campanha_mensagem();

ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens FORCE ROW LEVEL SECURITY;

-- Leitura condicional: mensagem pra cidadão só é visível a quem já vê PII nominal de cidadão
-- (mesma exclusão da migration 0006); mensagem pra apoiador/liderança é visível a todos os
-- papéis internos (mesmo padrão dessas duas tabelas).
CREATE POLICY mensagens_select ON mensagens
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND (
            tipo_destinatario <> 'cidadao'
            OR current_papel() NOT IN ('advogado_responsavel', 'assistente_juridico', 'coord_marketing', 'redator_marketing')
        )
    );

-- Criação: mensagem pra cidadão só coord_campanha (mesma regra de digitar formulário de
-- eleitor); mensagem pra apoiador/liderança também libera coord_marketing.
CREATE POLICY mensagens_insert ON mensagens
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND (
            (tipo_destinatario = 'cidadao' AND current_papel() = 'coord_campanha')
            OR (tipo_destinatario IN ('apoiador', 'lideranca') AND current_papel() IN ('coord_campanha', 'coord_marketing'))
        )
    );

-- Sem UPDATE/DELETE por usuário: o status final já é decidido dentro da mesma requisição que
-- cria a mensagem (Route Handler resolve se o provedor está configurado antes do INSERT) — não
-- há necessidade de alguém alterar o registro depois. Vira log imutável, na prática.
GRANT SELECT, INSERT ON mensagens TO authenticated;
REVOKE ALL ON mensagens FROM anon;
