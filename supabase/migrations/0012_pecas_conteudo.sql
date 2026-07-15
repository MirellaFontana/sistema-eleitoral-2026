-- Módulo 3 — Jurídico: Conformidade e rotulagem IA (ref. .pipeline/specs.md [2026-07-15]
-- "Módulo 3 — Jurídico: Conformidade e rotulagem IA"). Regra de Ouro nº1 (CLAUDE.md): todo
-- conteúdo gerado por IA tem rótulo obrigatório antes de publicar, e nenhuma peça sintética
-- nova é publicada na janela de silêncio de 72h antes / 24h depois do pleito.

CREATE TYPE tipo_peca_conteudo AS ENUM (
    'post', 'whatsapp', 'carrossel', 'roteiro_video', 'audio', 'video', 'imagem', 'outro'
);
CREATE TYPE canal_peca_conteudo AS ENUM (
    'site', 'whatsapp', 'instagram', 'tiktok', 'facebook', 'radio', 'tv', 'outro'
);
CREATE TYPE status_peca_conteudo AS ENUM ('rascunho', 'aprovado', 'publicado', 'bloqueado_janela');

CREATE TABLE pecas_conteudo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    tipo tipo_peca_conteudo NOT NULL,
    usou_ia BOOLEAN NOT NULL DEFAULT FALSE,
    ferramenta TEXT,                                       -- nome da ferramenta/modelo, quando usou_ia
    sugestao_conteudo_id UUID REFERENCES sugestoes_conteudo(id), -- rastreabilidade opcional (Módulo 4)
    prompt TEXT,
    rotulo_aplicado BOOLEAN NOT NULL DEFAULT FALSE,
    rotulo_texto TEXT,                                     -- snapshot do texto do rótulo exibido
    aprovador_id UUID REFERENCES usuarios_internos(id),
    canal canal_peca_conteudo NOT NULL,
    status status_peca_conteudo NOT NULL DEFAULT 'rascunho',
    publicado_em TIMESTAMPTZ,
    criado_por UUID NOT NULL REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Travas de banco (não só validação de UI) — Regra de Ouro nº1.
    CONSTRAINT publicacao_exige_aprovador CHECK (status <> 'publicado' OR aprovador_id IS NOT NULL),
    CONSTRAINT publicacao_ia_exige_rotulo CHECK (status <> 'publicado' OR NOT usou_ia OR rotulo_aplicado)
);

CREATE INDEX idx_pecas_conteudo_campanha ON pecas_conteudo (campanha_id);
CREATE INDEX idx_pecas_conteudo_status ON pecas_conteudo (campanha_id, status);

-- Janela de bloqueio: 72h antes / 24h depois do pleito (1º turno, 04/10/2026). Constante fixa
-- (não configurável por campanha — todas disputam a mesma eleição geral). Não cobre eventual
-- 2º turno (data ainda não definida) — revisar quando/se houver.
CREATE OR REPLACE FUNCTION dentro_janela_bloqueio()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT now() >= '2026-10-01 00:00:00-03'::TIMESTAMPTZ
       AND now() <  '2026-10-05 00:00:00-03'::TIMESTAMPTZ;
$$;

-- Bloqueia criação e publicação de peça sintética nova durante a janela. Peça já publicada
-- antes da janela começar não é afetada retroativamente (o trigger só olha escritas novas).
CREATE OR REPLACE FUNCTION bloquear_ia_na_janela()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.usou_ia AND dentro_janela_bloqueio() THEN
        IF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'Janela de silêncio eleitoral (72h antes/24h depois do pleito): não é permitido criar peça de conteúdo sintético neste período.';
        ELSIF TG_OP = 'UPDATE' AND NEW.status = 'publicado' AND OLD.status <> 'publicado' THEN
            RAISE EXCEPTION 'Janela de silêncio eleitoral (72h antes/24h depois do pleito): não é permitido publicar peça de conteúdo sintético neste período.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pecas_conteudo_janela_bloqueio
    BEFORE INSERT OR UPDATE ON pecas_conteudo
    FOR EACH ROW EXECUTE FUNCTION bloquear_ia_na_janela();

-- Separação de poder: autor (coord_marketing/redator_marketing/coord_campanha) pode criar e
-- editar rascunho, mas só quem tem poder de aprovação (advogado_responsavel, assistente_juridico,
-- coord_campanha, coord_marketing — decisão do usuário de incluir coord_marketing) pode setar
-- rótulo/aprovador ou levar a peça a "publicado". Reforçado por trigger, não só por RLS de linha,
-- porque RLS de UPDATE não distingue quais colunas mudaram dentro da mesma policy.
CREATE OR REPLACE FUNCTION restringir_aprovacao_pecas_conteudo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF current_papel() NOT IN ('advogado_responsavel', 'assistente_juridico', 'coord_campanha', 'coord_marketing') THEN
        IF NEW.rotulo_aplicado IS DISTINCT FROM OLD.rotulo_aplicado
           OR NEW.rotulo_texto IS DISTINCT FROM OLD.rotulo_texto
           OR NEW.aprovador_id IS DISTINCT FROM OLD.aprovador_id
           OR (NEW.status = 'publicado' AND OLD.status <> 'publicado')
        THEN
            RAISE EXCEPTION 'Papel % não tem permissão para aprovar/rotular/publicar peça de conteúdo', current_papel();
        END IF;
    END IF;
    -- Ninguém assina aprovação em nome de outro usuário.
    IF NEW.aprovador_id IS DISTINCT FROM OLD.aprovador_id AND NEW.aprovador_id IS NOT NULL AND NEW.aprovador_id <> auth.uid() THEN
        RAISE EXCEPTION 'aprovador_id deve ser o usuário autenticado atual';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pecas_conteudo_restringir_aprovacao
    BEFORE UPDATE ON pecas_conteudo
    FOR EACH ROW EXECUTE FUNCTION restringir_aprovacao_pecas_conteudo();

ALTER TABLE pecas_conteudo ENABLE ROW LEVEL SECURITY;
ALTER TABLE pecas_conteudo FORCE ROW LEVEL SECURITY;

-- Leitura: qualquer papel interno da campanha (dossiê de defesa precisa ser consultável por todos).
CREATE POLICY pecas_conteudo_select ON pecas_conteudo
    FOR SELECT USING (campanha_id = current_campanha_id());

-- Criação (rascunho): quem produz conteúdo. Aprovadores puros (advogado/assistente) não criam.
CREATE POLICY pecas_conteudo_insert ON pecas_conteudo
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing')
        AND criado_por = auth.uid()
    );

-- Edição (rascunho e aprovação, no mesmo comando de RLS) — a separação de QUAIS campos cada
-- papel pode tocar é feita pelo trigger acima, não aqui.
CREATE POLICY pecas_conteudo_update ON pecas_conteudo
    FOR UPDATE
    USING (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing', 'redator_marketing', 'advogado_responsavel', 'assistente_juridico')
    )
    WITH CHECK (campanha_id = current_campanha_id());

-- Sem policy de DELETE: peça de conteúdo (mesmo rascunho) não é apagável — é material que pode
-- compor o dossiê de defesa mais tarde, mesmo se descartada da publicação (vira só um status).

GRANT SELECT, INSERT, UPDATE ON pecas_conteudo TO authenticated;
