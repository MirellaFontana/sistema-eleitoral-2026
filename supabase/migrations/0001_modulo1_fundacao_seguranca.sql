-- Módulo 1 — Fundação multitenant e segurança (ref. .pipeline/specs.md [2026-07-12])

-- 1. EXTENSÕES E TIPOS
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE papel_usuario AS ENUM ('embaixador', 'advogado', 'coord_comunicacao', 'coord_campanha', 'candidato');
CREATE TYPE status_usuario_interno AS ENUM ('ativo', 'revogado', 'expirado');
CREATE TYPE status_campanha AS ENUM ('ativa', 'suspensa', 'encerrada');
CREATE TYPE circulo_eleitor AS ENUM ('quente', 'morno', 'frio');
CREATE TYPE estagio_funil AS ENUM ('atracao', 'interacao', 'ativacao', 'advocacia');
-- Enum fechado é a trava contra "cidadão entra por importação/digitação" (CLAUDE.md): não existe valor para isso.
CREATE TYPE origem_cadastro_cidadao AS ENUM ('enquete', 'demanda', 'app', 'embaixador');
CREATE TYPE canal_consentimento AS ENUM ('whatsapp', 'formulario_web', 'app', 'porta_a_porta');
CREATE TYPE status_consentimento AS ENUM ('ativo', 'revogado');

-- 2. TABELAS MESTRE (TENANCY)
CREATE TABLE campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_candidato TEXT NOT NULL,
    cargo TEXT,
    uf CHAR(2),
    partido TEXT,
    plano_contratado TEXT,
    status status_campanha NOT NULL DEFAULT 'ativa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuarios_internos (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    papel papel_usuario NOT NULL,
    nome TEXT NOT NULL,
    territorio_id UUID, -- FK adicionada após CREATE TABLE territorios (dependência circular)
    exige_mfa BOOLEAN NOT NULL DEFAULT FALSE,
    status status_usuario_interno NOT NULL DEFAULT 'ativo',
    expira_em TIMESTAMPTZ, -- obrigatório (via CHECK abaixo) quando papel = 'embaixador'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT embaixador_precisa_expiracao CHECK (papel <> 'embaixador' OR expira_em IS NOT NULL)
);

-- 3. INTELIGÊNCIA TERRITORIAL
CREATE TABLE territorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    nome_bairro TEXT,
    zona_eleitoral TEXT,
    geom GEOGRAPHY(MULTIPOLYGON, 4326),
    votos_disponiveis_estimados INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE usuarios_internos
    ADD CONSTRAINT usuarios_internos_territorio_fk FOREIGN KEY (territorio_id) REFERENCES territorios(id),
    ADD CONSTRAINT embaixador_precisa_territorio CHECK (papel <> 'embaixador' OR territorio_id IS NOT NULL);

-- 4. CRM POLÍTICO (CIDADÃOS)
CREATE TABLE cidadaos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    nome TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    email TEXT,
    circulo circulo_eleitor NOT NULL DEFAULT 'frio',
    estagio estagio_funil NOT NULL DEFAULT 'atracao',
    territorio_id UUID REFERENCES territorios(id),
    secao_eleitoral TEXT,
    geom GEOGRAPHY(POINT, 4326),
    temas_interesse TEXT[] DEFAULT '{}',
    atendido_por_ia BOOLEAN NOT NULL DEFAULT FALSE, -- sustenta o rótulo obrigatório de conteúdo sintético (TSE 23.732/2024)
    origem_cadastro origem_cadastro_cidadao NOT NULL,
    embaixador_coletor_id UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_whatsapp_por_campanha UNIQUE (campanha_id, whatsapp),
    CONSTRAINT embaixador_coletor_obrigatorio CHECK (origem_cadastro <> 'embaixador' OR embaixador_coletor_id IS NOT NULL)
);

-- 5. COMPLIANCE LGPD E AUDITORIA
CREATE TABLE consentimentos_lgpd (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cidadao_id UUID NOT NULL REFERENCES cidadaos(id),
    campanha_id UUID NOT NULL REFERENCES campanhas(id), -- denormalizado: RLS direta sem join em cidadaos
    finalidade TEXT NOT NULL,
    base_legal TEXT NOT NULL,
    texto_aceito TEXT NOT NULL,
    canal_origem canal_consentimento NOT NULL,
    ip_origem INET,
    geom_coleta GEOGRAPHY(POINT, 4326),
    status status_consentimento NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT porta_a_porta_exige_geo CHECK (canal_origem <> 'porta_a_porta' OR geom_coleta IS NOT NULL)
);

CREATE TABLE log_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    usuario_id UUID REFERENCES usuarios_internos(id),
    acao TEXT NOT NULL,
    tabela_afetada TEXT,
    entidade_id UUID,
    antes JSONB,
    depois JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trilha append-only travada por trigger, não só por ausência de policy de RLS
-- (RLS não protege contra roles com BYPASSRLS, ex.: service_role/postgres).
CREATE OR REPLACE FUNCTION bloquear_update_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% é append-only: % não é permitido', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER trg_log_auditoria_append_only
    BEFORE UPDATE OR DELETE ON log_auditoria
    FOR EACH ROW EXECUTE FUNCTION bloquear_update_delete();

CREATE TRIGGER trg_consentimentos_append_only
    BEFORE UPDATE OR DELETE ON consentimentos_lgpd
    FOR EACH ROW EXECUTE FUNCTION bloquear_update_delete();

-- 6. ÍNDICES (campanha_id é filtro de toda policy de RLS abaixo)
CREATE INDEX idx_usuarios_internos_campanha ON usuarios_internos (campanha_id);
CREATE INDEX idx_territorios_campanha ON territorios (campanha_id);
CREATE INDEX idx_cidadaos_campanha ON cidadaos (campanha_id);
CREATE INDEX idx_cidadaos_territorio ON cidadaos (territorio_id);
CREATE INDEX idx_cidadaos_geom ON cidadaos USING GIST (geom);
CREATE INDEX idx_consentimentos_campanha ON consentimentos_lgpd (campanha_id);
CREATE INDEX idx_consentimentos_cidadao ON consentimentos_lgpd (cidadao_id);
CREATE INDEX idx_log_auditoria_campanha ON log_auditoria (campanha_id);

-- 7. FUNÇÕES HELPER DE RLS
-- SECURITY DEFINER + search_path fixo: evita hijack de search_path e permite ler
-- usuarios_internos mesmo com RLS habilitada nessa tabela (senão, referência circular).
CREATE OR REPLACE FUNCTION current_campanha_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT campanha_id FROM usuarios_internos WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_papel()
RETURNS papel_usuario LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT papel FROM usuarios_internos WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_territorio_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT territorio_id FROM usuarios_internos WHERE id = auth.uid();
$$;

-- Supabase marca sessão com MFA verificada via claim 'aal' = 'aal2' (Authenticator Assurance Level).
CREATE OR REPLACE FUNCTION mfa_verificado()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT COALESCE(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- 8. ROW LEVEL SECURITY
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE territorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cidadaos ENABLE ROW LEVEL SECURITY;
ALTER TABLE consentimentos_lgpd ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_auditoria ENABLE ROW LEVEL SECURITY;

ALTER TABLE campanhas FORCE ROW LEVEL SECURITY;
ALTER TABLE usuarios_internos FORCE ROW LEVEL SECURITY;
ALTER TABLE territorios FORCE ROW LEVEL SECURITY;
ALTER TABLE cidadaos FORCE ROW LEVEL SECURITY;
ALTER TABLE consentimentos_lgpd FORCE ROW LEVEL SECURITY;
ALTER TABLE log_auditoria FORCE ROW LEVEL SECURITY;

-- campanhas: cada usuário só vê a própria campanha; edição travada a coord_campanha com MFA verificado
CREATE POLICY campanhas_select ON campanhas
    FOR SELECT USING (id = current_campanha_id());

CREATE POLICY campanhas_update ON campanhas
    FOR UPDATE
    USING (id = current_campanha_id() AND current_papel() = 'coord_campanha' AND mfa_verificado())
    WITH CHECK (id = current_campanha_id());

-- usuarios_internos: visão da própria campanha; gestão (insert/update de papel/status) só coord_campanha
CREATE POLICY usuarios_internos_select ON usuarios_internos
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY usuarios_internos_insert ON usuarios_internos
    FOR INSERT
    WITH CHECK (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha' AND mfa_verificado());

CREATE POLICY usuarios_internos_update ON usuarios_internos
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha' AND mfa_verificado())
    WITH CHECK (campanha_id = current_campanha_id());

-- territorios: leitura por qualquer papel interno da campanha; escrita só coord_campanha
CREATE POLICY territorios_select ON territorios
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY territorios_insert ON territorios
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha');

CREATE POLICY territorios_update ON territorios
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha')
    WITH CHECK (campanha_id = current_campanha_id());

-- cidadaos: policy única por comando (evita o bug de policies permissivas OR'd
-- entre si — combinar tudo num único USING é o que garante AND das condições).
-- Advogado, Candidato e Coord. comunicação não acessam PII nominal (especificação §3.2);
-- Embaixador só o próprio território.
CREATE POLICY cidadaos_select ON cidadaos
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND current_papel() NOT IN ('advogado', 'candidato', 'coord_comunicacao')
        AND (current_papel() <> 'embaixador' OR territorio_id = current_territorio_id())
    );

-- Cadastro por embaixador em campo. Cadastro via enquete/demanda/app do cidadão roda por
-- função backend com service_role (cidadão não é usuarios_internos) — fora do escopo desta policy;
-- ver dependências em .pipeline/specs.md.
CREATE POLICY cidadaos_insert_embaixador ON cidadaos
    FOR INSERT
    WITH CHECK (
        campanha_id = current_campanha_id()
        AND current_papel() = 'embaixador'
        AND origem_cadastro = 'embaixador'
        AND embaixador_coletor_id = auth.uid()
        AND territorio_id = current_territorio_id()
    );

CREATE POLICY cidadaos_update_coord ON cidadaos
    FOR UPDATE
    USING (campanha_id = current_campanha_id() AND current_papel() = 'coord_campanha')
    WITH CHECK (campanha_id = current_campanha_id());
-- Sem policy de DELETE: cidadão não é apagável por papel algum nesta migration (decisão em aberto: expurgo LGPD).

-- consentimentos_lgpd: mesma regra de visibilidade de PII de cidadaos; sem UPDATE/DELETE (append-only, reforçado por trigger)
CREATE POLICY consentimentos_select ON consentimentos_lgpd
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND current_papel() NOT IN ('advogado', 'candidato', 'coord_comunicacao')
    );

CREATE POLICY consentimentos_insert ON consentimentos_lgpd
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id());

-- log_auditoria: qualquer usuário interno registra ação da própria campanha; leitura travada ao bloco jurídico/gestão
CREATE POLICY log_auditoria_insert ON log_auditoria
    FOR INSERT WITH CHECK (campanha_id = current_campanha_id() AND usuario_id = auth.uid());

CREATE POLICY log_auditoria_select ON log_auditoria
    FOR SELECT USING (campanha_id = current_campanha_id() AND current_papel() IN ('coord_campanha', 'advogado'));

-- 9. GRANTS
-- anon não recebe grant nenhum aqui de propósito: captação de cidadão (app/enquete/demanda)
-- passa por função SECURITY DEFINER dedicada (módulo de captação, fora desta migration).
GRANT SELECT, INSERT, UPDATE ON campanhas, usuarios_internos, territorios, cidadaos TO authenticated;
GRANT SELECT, INSERT ON consentimentos_lgpd, log_auditoria TO authenticated; -- sem UPDATE/DELETE: reforça append-only no nível de grant
