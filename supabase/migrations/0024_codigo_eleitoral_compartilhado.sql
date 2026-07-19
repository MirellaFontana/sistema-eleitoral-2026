-- Código Eleitoral pré-carregado em toda campanha (ref. specs.md [2026-07-18] "Código Eleitoral
-- compartilhado entre campanhas"). É a mesma lei federal pra qualquer campanha — não faz sentido
-- cada uma subir o próprio PDF nem duplicar o arquivo (o compêndio do TSE sozinho tem ~9MB) em
-- storage por tenant. Primeira exceção deliberada à regra "tudo isolado por campanha_id" deste
-- sistema: os 2 PDFs vivem uma vez só, no prefixo `_global/codigo-eleitoral/` do bucket
-- `base-conhecimento` (upload feito fora desta migration, via `supabase storage cp`) — cada
-- campanha ganha sua própria linha em `temas_campanha`/`base_conhecimento_itens` (isso continua
-- por tenant, RLS normal), só o `arquivo_path` aponta pro arquivo compartilhado.

-- Leitura do prefixo _global liberada pra qualquer usuário interno ativo, de qualquer campanha —
-- current_papel() já retorna NULL pra usuário revogado/expirado (migration 0023), então a mesma
-- trava de "só quem está ativo" vale aqui também.
CREATE POLICY base_conhecimento_storage_select_global ON storage.objects
    FOR SELECT USING (
        bucket_id = 'base-conhecimento'
        AND (storage.foldername(name))[1] = '_global'
        AND current_papel() IS NOT NULL
    );

-- Sem policy de INSERT/UPDATE/DELETE pro prefixo _global: conteúdo de referência mantido pela
-- operação do sistema, não editável por usuário nenhum (nem coord_campanha).

CREATE OR REPLACE FUNCTION seed_codigo_eleitoral(p_campanha_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tema_id UUID;
    v_item_id UUID;
BEGIN
    IF EXISTS (
        SELECT 1 FROM temas_campanha WHERE campanha_id = p_campanha_id AND nome = 'Código Eleitoral'
    ) THEN
        RETURN;
    END IF;

    INSERT INTO temas_campanha (campanha_id, nome, ordem)
    VALUES (p_campanha_id, 'Código Eleitoral', 0)
    RETURNING id INTO v_tema_id;

    INSERT INTO base_conhecimento_itens (campanha_id, tema_id, titulo, descricao)
    VALUES (
        p_campanha_id, v_tema_id,
        'Código Eleitoral Anotado e Legislação Complementar — 17ª edição (TSE, 2026)',
        'Compêndio oficial do TSE: Código Eleitoral anotado + legislação complementar. Referência completa — mesmo conteúdo pra todas as campanhas, mantido pelo sistema.'
    )
    RETURNING id INTO v_item_id;

    INSERT INTO base_conhecimento_arquivos (item_id, campanha_id, arquivo_path, arquivo_nome_original)
    VALUES (
        v_item_id, p_campanha_id,
        '_global/codigo-eleitoral/codigo-eleitoral-anotado-tse-2026.pdf',
        'Codigo_Eleitoral_Anotado_TSE_2026.pdf'
    );

    INSERT INTO base_conhecimento_itens (campanha_id, tema_id, titulo, descricao)
    VALUES (
        p_campanha_id, v_tema_id,
        'Código Eleitoral — Lei nº 4.737/1965 (atualizado até abril/2023)',
        'Texto da Lei nº 4.737/1965 (Código Eleitoral), versão enxuta pra consulta rápida do texto de lei em si.'
    )
    RETURNING id INTO v_item_id;

    INSERT INTO base_conhecimento_arquivos (item_id, campanha_id, arquivo_path, arquivo_nome_original)
    VALUES (
        v_item_id, p_campanha_id,
        '_global/codigo-eleitoral/codigo-eleitoral-lei-4737-1965.pdf',
        'Codigo_eleitoral_Lei_4737_1965.pdf'
    );
END;
$$;

-- bootstrap_campanha passa a semear o Código Eleitoral pra toda campanha nova. Assinatura
-- continua a mesma de 7 parâmetros (migration 0021) — CREATE OR REPLACE direto, sem DROP.
CREATE OR REPLACE FUNCTION bootstrap_campanha(
    p_nome_candidato TEXT,
    p_cargo TEXT,
    p_uf CHAR(2),
    p_partido TEXT,
    p_plano_contratado TEXT,
    p_nome_usuario TEXT,
    p_telefone TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_campanha_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'bootstrap_campanha exige usuário autenticado';
    END IF;

    IF EXISTS (SELECT 1 FROM usuarios_internos WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'usuário autenticado já pertence a uma campanha — bootstrap não pode ser chamado de novo';
    END IF;

    IF p_telefone IS NULL OR btrim(p_telefone) = '' THEN
        RAISE EXCEPTION 'telefone é obrigatório';
    END IF;

    INSERT INTO campanhas (nome_candidato, cargo, uf, partido, plano_contratado)
    VALUES (p_nome_candidato, p_cargo, p_uf, p_partido, p_plano_contratado)
    RETURNING id INTO v_campanha_id;

    INSERT INTO usuarios_internos (id, campanha_id, papel, nome, telefone, exige_mfa, status)
    VALUES (auth.uid(), v_campanha_id, 'coord_campanha', p_nome_usuario, p_telefone, true, 'ativo');

    PERFORM seed_codigo_eleitoral(v_campanha_id);

    RETURN v_campanha_id;
END;
$$;

-- Backfill: campanhas que já existem e ainda não têm o tema.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM campanhas LOOP
        PERFORM seed_codigo_eleitoral(r.id);
    END LOOP;
END $$;
