CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);

-- Usuário fake para o teste
INSERT INTO auth.users (id, email) VALUES ('99999999-0000-0000-0000-000000000001', 'bootstrap_test@teste.local');

-- 1. Bootstrap cria campanha + usuario_interno coord_campanha
DO $$
DECLARE v_campanha_id uuid; v_papel papel_usuario; v_count_camp int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub','99999999-0000-0000-0000-000000000001')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT bootstrap_campanha('Candidata Teste Bootstrap','deputado estadual','SP','PARTIDO_X','pro','Coord Bootstrap') INTO v_campanha_id;
  RESET ROLE;

  SELECT papel INTO v_papel FROM usuarios_internos WHERE id = '99999999-0000-0000-0000-000000000001';
  SELECT count(*) INTO v_count_camp FROM campanhas WHERE id = v_campanha_id;

  INSERT INTO test_results(test, passed, detail) VALUES (
    '1. bootstrap_campanha cria campanha + coord_campanha',
    v_papel = 'coord_campanha' AND v_count_camp = 1,
    'papel=' || v_papel || ' campanhas_criadas=' || v_count_camp
  );
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. bootstrap_campanha cria campanha + coord_campanha', false, 'ERRO: ' || SQLERRM);
END $$;

-- 2. Segunda chamada do mesmo usuário deve falhar (já pertence a uma campanha)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub','99999999-0000-0000-0000-000000000001')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM bootstrap_campanha('Segunda Campanha','deputado federal','RJ','PARTIDO_Y','pro','Outro Nome');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. segunda chamada bloqueada', false, 'passou sem erro (deveria falhar)');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. segunda chamada bloqueada', true, 'bloqueado: ' || SQLERRM);
  END;
END $$;

-- 3. anon não pode executar a função (revoke explícito)
DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM bootstrap_campanha('X','Y','SP','Z','W','Q');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('3. anon sem EXECUTE', false, 'anon conseguiu chamar');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('3. anon sem EXECUTE', true, 'bloqueado: ' || SQLERRM);
  END;
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM usuarios_internos WHERE id = '99999999-0000-0000-0000-000000000001';
DELETE FROM campanhas WHERE nome_candidato IN ('Candidata Teste Bootstrap','Segunda Campanha');
DELETE FROM auth.users WHERE id = '99999999-0000-0000-0000-000000000001';
