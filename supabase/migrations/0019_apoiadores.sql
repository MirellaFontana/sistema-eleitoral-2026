-- Módulo Relacionamento — parte 1: Cadastro de apoiadores (ref. .pipeline/specs.md [2026-07-16]
-- "Módulo Relacionamento — parte 1: Cadastro de apoiadores").
-- Apoiador é pessoa que se oferece pra ajudar a campanha — não precisa já ser cidadão cadastrado.
-- Base legal mais leve que cidadaos (legítimo interesse pra coordenação de voluntários, não
-- consentimento explícito) — decisão de produto registrada na spec, pro Revisor confirmar com
-- o jurídico do cliente antes de uso real.

CREATE TYPE status_apoiador AS ENUM ('ativo', 'inativo');
CREATE TYPE forma_ajuda_apoiador AS ENUM (
    'transporte', 'espaco_reuniao', 'redes_sociais', 'distribuicao_material', 'tempo_voluntario', 'doacao_material', 'outro'
);

CREATE TABLE apoiadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    cidade TEXT,
    bairro TEXT,
    territorio_id UUID REFERENCES territorios(id),
    cidadao_id UUID REFERENCES cidadaos(id), -- opcional: liga a um cidadão já cadastrado, evita duplicar a mesma pessoa
    formas_ajuda forma_ajuda_apoiador[] NOT NULL DEFAULT '{}',
    detalhe_ajuda TEXT,
    disponibilidade TEXT,
    status status_apoiador NOT NULL DEFAULT 'ativo',
    criado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_apoiadores_campanha ON apoiadores (campanha_id);
CREATE INDEX idx_apoiadores_cidadao ON apoiadores (cidadao_id);

-- Separação de poder: só coord_campanha liga/desliga um apoiador a um cidadão. coord_marketing
-- também gerencia apoiadores, mas não tem acesso a dado nominal de cidadaos (migration 0006) —
-- deixá-lo setar cidadao_id livremente contornaria essa trava. Reforçado por trigger, mesmo
-- padrão de pecas_conteudo/alertas (RLS de UPDATE não distingue quais colunas mudaram).
CREATE OR REPLACE FUNCTION restringir_vinculo_cidadao_apoiador()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.cidadao_id IS DISTINCT FROM OLD.cidadao_id AND current_papel() <> 'coord_campanha' THEN
        RAISE EXCEPTION 'Só coord_campanha vincula apoiador a um cidadão cadastrado';
    END IF;
    IF NEW.cidadao_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM cidadaos c WHERE c.id = NEW.cidadao_id AND c.campanha_id = NEW.campanha_id
    ) THEN
        RAISE EXCEPTION 'cidadao_id precisa pertencer à mesma campanha do apoiador';
    END IF;
    RETURN NEW;
END;
$$;

-- Mesma checagem no INSERT (trigger acima só cobre UPDATE, que tem OLD; INSERT precisa da sua própria).
CREATE OR REPLACE FUNCTION restringir_vinculo_cidadao_apoiador_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.cidadao_id IS NOT NULL THEN
        IF current_papel() <> 'coord_campanha' THEN
            RAISE EXCEPTION 'Só coord_campanha vincula apoiador a um cidadão cadastrado';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM cidadaos c WHERE c.id = NEW.cidadao_id AND c.campanha_id = NEW.campanha_id) THEN
            RAISE EXCEPTION 'cidadao_id precisa pertencer à mesma campanha do apoiador';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apoiadores_restringir_vinculo_insert
    BEFORE INSERT ON apoiadores
    FOR EACH ROW EXECUTE FUNCTION restringir_vinculo_cidadao_apoiador_insert();

CREATE TRIGGER trg_apoiadores_restringir_vinculo_update
    BEFORE UPDATE ON apoiadores
    FOR EACH ROW EXECUTE FUNCTION restringir_vinculo_cidadao_apoiador();

ALTER TABLE apoiadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE apoiadores FORCE ROW LEVEL SECURITY;

-- Leitura liberada a todos os papéis internos (apoiador não tem a sensibilidade de "eleitor
-- nominal" — é voluntário, mais próximo de liderança do que de cidadão). Gestão por
-- coord_campanha + coord_marketing. Sem DELETE — só status ativo/inativo, mesmo padrão de liderancas.
CREATE POLICY apoiadores_select ON apoiadores
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY apoiadores_insert ON apoiadores
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() IN ('coord_campanha', 'coord_marketing')
    );

CREATE POLICY apoiadores_update ON apoiadores
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'coord_marketing'))
    WITH CHECK (campanha_id = current_campanha_id());

GRANT SELECT, INSERT, UPDATE ON apoiadores TO authenticated;
REVOKE ALL ON apoiadores FROM anon;
