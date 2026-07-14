CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_coord_campanha_a'), ('user_embaixador_a'), ('user_coord_campanha_b');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha CD A', 'deputado estadual', 'SP', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha CD B', 'deputado estadual', 'SP', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_b' AND c.name='camp_b';

DO $$
DECLARE v_terr uuid;
BEGIN
  INSERT INTO territorios (campanha_id, nome_bairro) SELECT id, 'Bairro Teste CD' FROM fixture_ids WHERE name='camp_a' RETURNING id INTO v_terr;
  INSERT INTO usuarios_internos (id, campanha_id, papel, nome, territorio_id, expira_em)
  SELECT u.id, c.id, 'embaixador', 'Emb A', v_terr, now() + interval '30 days'
  FROM fixture_ids u, fixture_ids c WHERE u.name='user_embaixador_a' AND c.name='camp_a';
END $$;

-- 1. coord_campanha cria concorrente (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO concorrentes (campanha_id, nome, partido, pontos_fortes, pontos_fracos, promessas)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Fulano Concorrente', 'PARTIDO_X', 'Bem conhecido na região', 'Sem propostas claras', 'Promete construir hospital')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. coord_campanha cria concorrente (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. coord_campanha cria concorrente (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. embaixador NAO cria concorrente
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO concorrentes (campanha_id, nome) VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Nao deveria');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. embaixador nao cria concorrente', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. embaixador nao cria concorrente', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 3. embaixador CONSEGUE ler concorrentes (positivo)
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM concorrentes WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. embaixador le concorrentes (positivo)', v_count = 1, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. embaixador le concorrentes (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 4. Isolamento cross-tenant em concorrentes
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM concorrentes WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. isolamento cross-tenant (concorrentes)', v_count = 0, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. isolamento cross-tenant (concorrentes)', false, 'ERRO: '||SQLERRM);
END $$;

-- 5. coord_campanha cria demanda observada (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO demandas_observadas (campanha_id, regiao, cidade, tema, demanda)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Zona Leste', 'Uberaba', 'saude', 'Falta de posto de saúde no bairro')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. coord_campanha cria demanda observada (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. coord_campanha cria demanda observada (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 6. embaixador NAO cria demanda observada
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO demandas_observadas (campanha_id, demanda) VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'nao deveria');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. embaixador nao cria demanda observada', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. embaixador nao cria demanda observada', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 7. Isolamento cross-tenant em demandas_observadas
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM demandas_observadas WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. isolamento cross-tenant (demandas_observadas)', v_count = 0, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. isolamento cross-tenant (demandas_observadas)', false, 'ERRO: '||SQLERRM);
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM concorrentes WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM demandas_observadas WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM territorios WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
