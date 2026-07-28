-- Permissões com escopo territorial para qualquer papel
-- + Configuração de retenção e descarte de dados

-- ============================================================================
-- 1. ESCOPO TERRITORIAL GENÉRICO
-- ============================================================================

ALTER TABLE usuarios_internos
    ADD COLUMN territorio_ids UUID[] NOT NULL DEFAULT '{}';

-- Migra embaixadores que já têm territorio_id para o array
UPDATE usuarios_internos
SET territorio_ids = ARRAY[territorio_id]
WHERE territorio_id IS NOT NULL;

-- Função utilitária: verifica se o usuário tem acesso a um território específico
CREATE OR REPLACE FUNCTION usuario_tem_territorio(p_territorio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM usuarios_internos
        WHERE id = auth.uid()
          AND status = 'ativo'
          AND (
              territorio_ids = '{}'
              OR p_territorio_id = ANY(territorio_ids)
              OR p_territorio_id IS NULL
              OR papel = 'coord_campanha'
              OR papel = 'candidato'
          )
    );
$$;

-- ============================================================================
-- 2. RETENÇÃO E DESCARTE DE DADOS CONFIGURÁVEIS
-- ============================================================================

CREATE TABLE configuracoes_retencao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id),

    tabela TEXT NOT NULL,
    dias_retencao INT NOT NULL DEFAULT 365,
    acao TEXT NOT NULL DEFAULT 'anonimizar',
    ativo BOOLEAN NOT NULL DEFAULT false,
    descricao TEXT,

    atualizado_por UUID REFERENCES usuarios_internos(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campanha_id, tabela)
);

ALTER TABLE configuracoes_retencao ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_retencao FORCE ROW LEVEL SECURITY;

CREATE POLICY config_retencao_select ON configuracoes_retencao
    FOR SELECT USING (campanha_id = current_campanha_id());

CREATE POLICY config_retencao_write ON configuracoes_retencao
    FOR ALL USING (
        campanha_id = current_campanha_id()
        AND current_papel() = 'coord_campanha'
    )
    WITH CHECK (campanha_id = current_campanha_id());

GRANT SELECT, INSERT, UPDATE ON configuracoes_retencao TO authenticated;

-- Seed: configurações padrão desativadas para tabelas com dados pessoais
INSERT INTO configuracoes_retencao (campanha_id, tabela, dias_retencao, acao, descricao)
SELECT c.id, t.tabela, t.dias, t.acao, t.descricao
FROM campanhas c,
(VALUES
    ('cidadaos', 730, 'anonimizar', 'Dados de eleitores — anonimizar após 2 anos do fim da campanha'),
    ('consentimentos_lgpd', 1825, 'manter', 'Consentimentos LGPD — manter 5 anos por exigência legal'),
    ('mensagens', 365, 'excluir', 'Mensagens enviadas — excluir após 1 ano'),
    ('log_auditoria', 1825, 'manter', 'Trilha de auditoria — manter 5 anos'),
    ('quarentena_registros', 90, 'excluir', 'Registros em quarentena — excluir após 90 dias')
) AS t(tabela, dias, acao, descricao);

-- Auditoria
CREATE TRIGGER trg_audit_config_retencao
    AFTER INSERT OR UPDATE ON configuracoes_retencao
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
