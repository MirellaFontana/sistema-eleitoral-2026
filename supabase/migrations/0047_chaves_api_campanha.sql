-- Chaves de API por campanha — cada candidato usa (e paga) suas próprias chaves.
-- pgcrypto já habilitado em 0001.

CREATE TYPE provedor_api AS ENUM ('anthropic', 'google_cse');

CREATE TABLE chaves_api (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),
    provedor provedor_api NOT NULL,
    chave_cifrada BYTEA NOT NULL,
    auxiliar TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    atualizado_por UUID REFERENCES usuarios_internos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_provedor_por_campanha UNIQUE (campanha_id, provedor)
);

CREATE INDEX idx_chaves_api_campanha ON chaves_api (campanha_id);

ALTER TABLE chaves_api ENABLE ROW LEVEL SECURITY;
ALTER TABLE chaves_api FORCE ROW LEVEL SECURITY;

-- Somente coord_campanha e candidato veem e gerenciam chaves.
CREATE POLICY chaves_api_select ON chaves_api
    FOR SELECT USING (
        campanha_id = current_campanha_id()
        AND (
            (SELECT papel FROM usuarios_internos WHERE id = auth.uid()) IN ('coord_campanha', 'candidato')
        )
    );

CREATE POLICY chaves_api_insert ON chaves_api
    FOR INSERT WITH CHECK (
        campanha_id = current_campanha_id()
        AND (
            (SELECT papel FROM usuarios_internos WHERE id = auth.uid()) IN ('coord_campanha', 'candidato')
        )
    );

CREATE POLICY chaves_api_update ON chaves_api
    FOR UPDATE
    USING (
        campanha_id = current_campanha_id()
        AND (
            (SELECT papel FROM usuarios_internos WHERE id = auth.uid()) IN ('coord_campanha', 'candidato')
        )
    )
    WITH CHECK (campanha_id = current_campanha_id());

CREATE POLICY chaves_api_delete ON chaves_api
    FOR DELETE USING (
        campanha_id = current_campanha_id()
        AND (
            (SELECT papel FROM usuarios_internos WHERE id = auth.uid()) IN ('coord_campanha', 'candidato')
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON chaves_api TO authenticated;

-- Funções server-side para cifrar/decifrar com a chave simétrica do ambiente.
-- A chave simétrica vive em API_ENCRYPTION_KEY (set via env do app).

CREATE OR REPLACE FUNCTION cifrar_chave_api(valor TEXT, senha TEXT)
RETURNS BYTEA
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER
AS $$
    SELECT extensions.pgp_sym_encrypt(valor, senha);
$$;

CREATE OR REPLACE FUNCTION decifrar_chave_api(cifrada BYTEA, senha TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER
AS $$
    SELECT extensions.pgp_sym_decrypt(cifrada, senha);
$$;
