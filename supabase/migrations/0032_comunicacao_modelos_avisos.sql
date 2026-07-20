-- Comunicação: biblioteca de mensagens aprovadas + central de avisos internos.
-- (ref. .pipeline/specs.md [2026-07-20] "Comunicação: biblioteca de mensagens aprovadas +
-- central de avisos internos")
--
-- Biblioteca de mensagens é catálogo de referência — deliberadamente NÃO integrada ao envio de
-- mensagens (/mensagens), confirmado com o usuário.
-- Central de avisos é tabela nova, decoupled de `alertas` (que segue como está, específica de
-- ameaça jurídica/crise via monitoramento_itens).

-- ══════════════════════════════════════════════════════════════════════════
-- 1. BIBLIOTECA DE MENSAGENS APROVADAS
-- ══════════════════════════════════════════════════════════════════════════

CREATE TYPE situacao_modelo_mensagem AS ENUM (
    'apresentacao_candidatura',
    'confirmacao_evento',
    'agradecimento',
    'resposta_proposta',
    'convite_voluntariado',
    'orientacao_apoiador',
    'retorno_demanda',
    'resposta_critica',
    'esclarecimento_informacao_falsa',
    'descadastramento'
);

CREATE TYPE status_modelo_mensagem AS ENUM ('rascunho', 'aprovado');

CREATE TABLE modelos_mensagem (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id   UUID NOT NULL REFERENCES campanhas(id),
    situacao      situacao_modelo_mensagem NOT NULL,
    titulo        TEXT NOT NULL,
    conteudo      TEXT NOT NULL,
    versao        INTEGER NOT NULL DEFAULT 1,
    status        status_modelo_mensagem NOT NULL DEFAULT 'rascunho',
    criado_por    UUID REFERENCES usuarios_internos(id),
    aprovado_por  UUID REFERENCES usuarios_internos(id),
    aprovado_em   TIMESTAMPTZ,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT modelo_aprovacao_coerente CHECK (
        (aprovado_em IS NULL AND aprovado_por IS NULL) OR
        (aprovado_em IS NOT NULL AND aprovado_por IS NOT NULL)
    )
);

CREATE INDEX idx_modelos_mensagem_campanha ON modelos_mensagem (campanha_id, situacao);

-- Editar conteúdo de modelo já aprovado deve derrubar a aprovação — sem isso, "aprovação do
-- marketing" vira decorativa (qualquer edição depois continuaria marcada como aprovada).
CREATE OR REPLACE FUNCTION bump_versao_modelo_mensagem()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.conteudo IS DISTINCT FROM OLD.conteudo THEN
        NEW.versao := OLD.versao + 1;
        NEW.status := 'rascunho';
        NEW.aprovado_por := NULL;
        NEW.aprovado_em := NULL;
    END IF;
    NEW.atualizado_em := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_versao_modelo_mensagem
    BEFORE UPDATE ON modelos_mensagem
    FOR EACH ROW EXECUTE FUNCTION bump_versao_modelo_mensagem();

-- Só coord_campanha/coord_marketing aprovam — reforçado por trigger, porque RLS de UPDATE não
-- distingue qual coluna mudou dentro do mesmo comando (mesmo padrão de
-- restringir_encaminhamento_alertas, migration 0017).
CREATE OR REPLACE FUNCTION restringir_aprovacao_modelo_mensagem()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.status IS DISTINCT FROM OLD.status
        OR NEW.aprovado_por IS DISTINCT FROM OLD.aprovado_por
        OR NEW.aprovado_em IS DISTINCT FROM OLD.aprovado_em)
       AND NEW.conteudo IS NOT DISTINCT FROM OLD.conteudo  -- não é o bump automático acima
       AND current_papel() NOT IN ('coord_campanha', 'coord_marketing')
    THEN
        RAISE EXCEPTION 'Só coordenação de campanha ou de marketing aprovam modelo de mensagem';
    END IF;
    IF NEW.aprovado_por IS DISTINCT FROM OLD.aprovado_por AND NEW.aprovado_por IS NOT NULL
       AND NEW.aprovado_por <> auth.uid()
    THEN
        RAISE EXCEPTION 'aprovado_por deve ser o usuário autenticado atual';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restringir_aprovacao_modelo_mensagem
    BEFORE UPDATE ON modelos_mensagem
    FOR EACH ROW EXECUTE FUNCTION restringir_aprovacao_modelo_mensagem();

ALTER TABLE modelos_mensagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_mensagem FORCE ROW LEVEL SECURITY;

CREATE POLICY modelos_mensagem_select ON modelos_mensagem
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY modelos_mensagem_insert ON modelos_mensagem
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
    );

CREATE POLICY modelos_mensagem_update ON modelos_mensagem
    FOR UPDATE
    USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
    )
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY modelos_mensagem_delete ON modelos_mensagem
    FOR DELETE USING (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha');

GRANT SELECT, INSERT, UPDATE, DELETE ON modelos_mensagem TO authenticated;
REVOKE ALL ON modelos_mensagem FROM anon;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. CENTRAL DE AVISOS INTERNOS
-- ══════════════════════════════════════════════════════════════════════════

CREATE TYPE categoria_aviso_interno AS ENUM (
    'mudanca_agenda',
    'nova_tarefa',
    'peca_aguardando_aprovacao',
    'prazo_eleitoral_proximo',
    'crise_identificada',
    'evento_alterado',
    'orientacao_juridica',
    'material_disponivel',
    'reuniao_convocada',
    'ocorrencia_territorio',
    'acesso_revogado',
    'incidente_seguranca'
);

CREATE TABLE avisos_internos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id       UUID NOT NULL REFERENCES campanhas(id),
    categoria         categoria_aviso_interno NOT NULL,
    titulo            TEXT NOT NULL,
    mensagem          TEXT NOT NULL,
    destinatario_papel papel_usuario,  -- NULL = todos os papéis internos ativos da campanha
    criado_por        UUID REFERENCES usuarios_internos(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_avisos_internos_campanha ON avisos_internos (campanha_id, created_at DESC);

-- Recibo de leitura por pessoa — um `lido_em` único no aviso ficaria errado aqui: aviso "pra
-- todos" marcado como lido por uma pessoa não pode esconder ele de quem ainda não abriu.
CREATE TABLE avisos_internos_lidos (
    aviso_id   UUID NOT NULL REFERENCES avisos_internos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios_internos(id) ON DELETE CASCADE,
    lido_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (aviso_id, usuario_id)
);

ALTER TABLE avisos_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos_internos FORCE ROW LEVEL SECURITY;
ALTER TABLE avisos_internos_lidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos_internos_lidos FORCE ROW LEVEL SECURITY;

-- coord_campanha sempre vê tudo, independente do destinatário; os demais só veem avisos gerais
-- (destinatario_papel nulo) ou dirigidos ao próprio papel.
CREATE POLICY avisos_internos_select ON avisos_internos
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND (
            destinatario_papel IS NULL
            OR destinatario_papel = current_papel()
            OR current_papel() = 'coord_campanha'
        )
    );

CREATE POLICY avisos_internos_insert ON avisos_internos
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN (
            'coord_campanha', 'coord_marketing', 'redator_marketing',
            'advogado_responsavel', 'assistente_juridico'
        )
    );

-- Sem UPDATE/DELETE de conteúdo — quadro de avisos é histórico; corrigir um aviso errado é
-- postar um novo, não editar o antigo.

CREATE POLICY avisos_internos_lidos_select ON avisos_internos_lidos
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY avisos_internos_lidos_insert ON avisos_internos_lidos
    FOR INSERT WITH CHECK (
        usuario_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM avisos_internos a
            WHERE a.id = aviso_id
              AND a.campanha_id = current_campanha_id()
              AND (
                  a.destinatario_papel IS NULL
                  OR a.destinatario_papel = current_papel()
                  OR current_papel() = 'coord_campanha'
              )
        )
    );

GRANT SELECT, INSERT ON avisos_internos TO authenticated;
GRANT SELECT, INSERT ON avisos_internos_lidos TO authenticated;
REVOKE ALL ON avisos_internos FROM anon;
REVOKE ALL ON avisos_internos_lidos FROM anon;

-- ── Gatilhos automáticos (2 categorias com evento de banco claro e barato — as outras 10
--    nascem manuais nesta entrega; ver specs.md pro raciocínio completo) ──────────────────────

-- "Peça aguardando aprovação": mesmo padrão de gerar_alertas_ameaca_grave (migration 0017) —
-- 1 aviso por papel aprovador (mesmo conjunto de aprovadores da migration 0012).
CREATE OR REPLACE FUNCTION aviso_peca_aguardando_aprovacao()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'rascunho' THEN
        INSERT INTO avisos_internos (campanha_id, categoria, titulo, mensagem, destinatario_papel)
        VALUES
            (NEW.campanha_id, 'peca_aguardando_aprovacao', 'Peça aguardando aprovação',
             'Uma nova peça de conteúdo foi criada e está aguardando aprovação.', 'advogado_responsavel'),
            (NEW.campanha_id, 'peca_aguardando_aprovacao', 'Peça aguardando aprovação',
             'Uma nova peça de conteúdo foi criada e está aguardando aprovação.', 'assistente_juridico'),
            (NEW.campanha_id, 'peca_aguardando_aprovacao', 'Peça aguardando aprovação',
             'Uma nova peça de conteúdo foi criada e está aguardando aprovação.', 'coord_campanha'),
            (NEW.campanha_id, 'peca_aguardando_aprovacao', 'Peça aguardando aprovação',
             'Uma nova peça de conteúdo foi criada e está aguardando aprovação.', 'coord_marketing');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aviso_peca_aguardando_aprovacao
    AFTER INSERT ON pecas_conteudo
    FOR EACH ROW EXECUTE FUNCTION aviso_peca_aguardando_aprovacao();

-- "Acesso revogado": avisa a coordenação quando um usuário interno é revogado.
CREATE OR REPLACE FUNCTION aviso_acesso_revogado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'revogado' AND OLD.status IS DISTINCT FROM 'revogado' THEN
        INSERT INTO avisos_internos (campanha_id, categoria, titulo, mensagem, destinatario_papel)
        VALUES (
            NEW.campanha_id, 'acesso_revogado', 'Acesso revogado',
            'O acesso de "' || NEW.nome || '" foi revogado.', 'coord_campanha'
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aviso_acesso_revogado
    AFTER UPDATE ON usuarios_internos
    FOR EACH ROW EXECUTE FUNCTION aviso_acesso_revogado();
