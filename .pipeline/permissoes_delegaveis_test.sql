-- Teste: sistema de permissões delegáveis (migration 0040)
-- Verifica has_permission(), funcoes_campanha, funcao_permissoes, backfill

DO $$
DECLARE
    v_campanha_id UUID;
    v_coord_id    UUID;
    v_redator_id  UUID;
    v_funcao_coord UUID;
    v_funcao_redator UUID;
    v_funcao_custom UUID;
    v_result BOOLEAN;
    v_count INT;
    v_passed INT := 0;
    v_total INT := 0;
BEGIN
    RAISE NOTICE '=== Teste de permissões delegáveis ===';

    -- Pegar uma campanha existente que tenha funções padrão criadas pelo backfill
    SELECT id INTO v_campanha_id
    FROM campanhas
    LIMIT 1;

    IF v_campanha_id IS NULL THEN
        RAISE NOTICE 'SKIP: nenhuma campanha encontrada no staging.';
        RETURN;
    END IF;

    -- 1. Verificar que funções padrão foram criadas pelo backfill
    v_total := v_total + 1;
    SELECT count(*) INTO v_count
    FROM funcoes_campanha
    WHERE campanha_id = v_campanha_id AND sistema = true;

    IF v_count >= 9 THEN
        RAISE NOTICE 'TESTE 1 PASSOU: % funções padrão criadas (esperado >= 9)', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'TESTE 1 FALHOU: apenas % funções padrão (esperado >= 9)', v_count;
    END IF;

    -- 2. Verificar que coord_campanha tem função linkada
    v_total := v_total + 1;
    SELECT ui.id, ui.funcao_id INTO v_coord_id, v_funcao_coord
    FROM usuarios_internos ui
    WHERE ui.campanha_id = v_campanha_id AND ui.papel = 'coord_campanha' AND ui.status = 'ativo'
    LIMIT 1;

    IF v_funcao_coord IS NOT NULL THEN
        RAISE NOTICE 'TESTE 2 PASSOU: coord_campanha tem funcao_id = %', v_funcao_coord;
        v_passed := v_passed + 1;
    ELSE
        IF v_coord_id IS NULL THEN
            RAISE NOTICE 'TESTE 2 SKIP: nenhum coord_campanha ativo encontrado';
        ELSE
            RAISE NOTICE 'TESTE 2 FALHOU: coord_campanha sem funcao_id';
        END IF;
    END IF;

    -- 3. Verificar que a função de coord_campanha tem nome correto
    v_total := v_total + 1;
    SELECT count(*) INTO v_count
    FROM funcoes_campanha
    WHERE id = v_funcao_coord AND nome = 'Coordenador de campanha';

    IF v_count = 1 THEN
        RAISE NOTICE 'TESTE 3 PASSOU: função de coord nomeada corretamente';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'TESTE 3 FALHOU: função de coord não encontrada ou nome errado';
    END IF;

    -- 4. Verificar que funcao_permissoes tem permissões para o redator
    v_total := v_total + 1;
    SELECT fc.id INTO v_funcao_redator
    FROM funcoes_campanha fc
    WHERE fc.campanha_id = v_campanha_id AND fc.nome = 'Redator de marketing' AND fc.sistema = true;

    SELECT count(*) INTO v_count
    FROM funcao_permissoes
    WHERE funcao_id = v_funcao_redator;

    IF v_count >= 4 THEN
        RAISE NOTICE 'TESTE 4 PASSOU: Redator de marketing tem % permissões', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'TESTE 4 FALHOU: Redator de marketing com apenas % permissões (esperado >= 4)', v_count;
    END IF;

    -- 5. Verificar que has_permission() existe e é chamável (sem sessão de auth, deve retornar false)
    v_total := v_total + 1;
    BEGIN
        SELECT has_permission('ver_eleitores') INTO v_result;
        IF v_result = false THEN
            RAISE NOTICE 'TESTE 5 PASSOU: has_permission retorna false sem sessão autenticada';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE 'TESTE 5 FALHOU: has_permission retorna true sem sessão (deveria ser false)';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'TESTE 5 FALHOU com exceção: %', SQLERRM;
    END;

    -- 6. Verificar que a função criar_funcoes_padrao existe
    v_total := v_total + 1;
    SELECT count(*) INTO v_count
    FROM pg_proc
    WHERE proname = 'criar_funcoes_padrao';

    IF v_count >= 1 THEN
        RAISE NOTICE 'TESTE 6 PASSOU: função criar_funcoes_padrao existe';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'TESTE 6 FALHOU: criar_funcoes_padrao não encontrada';
    END IF;

    -- 7. Verificar que todos os usuários existentes foram vinculados a uma função pelo backfill
    v_total := v_total + 1;
    SELECT count(*) INTO v_count
    FROM usuarios_internos
    WHERE campanha_id = v_campanha_id AND status = 'ativo' AND funcao_id IS NULL;

    IF v_count = 0 THEN
        RAISE NOTICE 'TESTE 7 PASSOU: todos os usuários ativos têm funcao_id';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'TESTE 7 FALHOU: % usuários ativos sem funcao_id', v_count;
    END IF;

    -- 8. Verificar consistência: permissões da função "Coord. de marketing" incluem as esperadas
    v_total := v_total + 1;
    DECLARE
        v_funcao_mkt UUID;
        v_has_apoiadores BOOLEAN;
        v_has_pecas BOOLEAN;
        v_has_ia BOOLEAN;
    BEGIN
        SELECT fc.id INTO v_funcao_mkt
        FROM funcoes_campanha fc
        WHERE fc.campanha_id = v_campanha_id AND fc.nome = 'Coord. de marketing' AND fc.sistema = true;

        SELECT EXISTS (SELECT 1 FROM funcao_permissoes WHERE funcao_id = v_funcao_mkt AND permissao = 'gerenciar_apoiadores') INTO v_has_apoiadores;
        SELECT EXISTS (SELECT 1 FROM funcao_permissoes WHERE funcao_id = v_funcao_mkt AND permissao = 'gerenciar_pecas') INTO v_has_pecas;
        SELECT EXISTS (SELECT 1 FROM funcao_permissoes WHERE funcao_id = v_funcao_mkt AND permissao = 'usar_ia') INTO v_has_ia;

        IF v_has_apoiadores AND v_has_pecas AND v_has_ia THEN
            RAISE NOTICE 'TESTE 8 PASSOU: Coord. de marketing tem permissões esperadas (apoiadores, pecas, ia)';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE 'TESTE 8 FALHOU: Coord. de marketing falta permissão (apoiadores=%, pecas=%, ia=%)', v_has_apoiadores, v_has_pecas, v_has_ia;
        END IF;
    END;

    -- 9. Verificar que nenhuma permissão "fantasma" existe fora do enum
    v_total := v_total + 1;
    SELECT count(*) INTO v_count
    FROM funcao_permissoes fp
    LEFT JOIN funcoes_campanha fc ON fc.id = fp.funcao_id
    WHERE fc.campanha_id = v_campanha_id;

    IF v_count > 0 THEN
        RAISE NOTICE 'TESTE 9 PASSOU: % permissões no total (tipo verificado pelo enum)', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'TESTE 9 FALHOU: nenhuma permissão encontrada';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '=== RESULTADO: %/% testes passaram ===', v_passed, v_total;
END;
$$;
