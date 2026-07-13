CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_coord_campanha_a'), ('user_embaixador_a'), ('user_candidato_a'), ('user_redator_a'),
 ('user_coord_campanha_b');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Monitoramento A', 'deputado estadual', 'SP', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Monitoramento B', 'deputado estadual', 'SP', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'candidato', 'Candidato A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_candidato_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'redator_marketing', 'Redator A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_redator_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_b' AND c.name='camp_b';

DO $$
DECLARE v_terr uuid;
BEGIN
  INSERT INTO territorios (campanha_id, nome_bairro) SELECT id, 'Bairro Teste Mon' FROM fixture_ids WHERE name='camp_a' RETURNING id INTO v_terr;
  INSERT INTO usuarios_internos (id, campanha_id, papel, nome, territorio_id, expira_em)
  SELECT u.id, c.id, 'embaixador', 'Emb A', v_terr, now() + interval '30 days'
  FROM fixture_ids u, fixture_ids c WHERE u.name='user_embaixador_a' AND c.name='camp_a';
END $$;

-- 1. redator_marketing (papel liberado) consegue criar item
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO monitoramento_itens (campanha_id, descricao, categoria)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Post suspeito de deepfake no X', 'deepfake_suspeito')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. redator_marketing cria item (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. redator_marketing cria item (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. embaixador NAO consegue criar item
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO monitoramento_itens (campanha_id, descricao, categoria)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Nao deveria', 'outro');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. embaixador nao cria item', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. embaixador nao cria item', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 3. candidato NAO consegue criar item (so leitura)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO monitoramento_itens (campanha_id, descricao, categoria)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Nao deveria', 'outro');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('3. candidato nao cria item (so leitura)', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('3. candidato nao cria item (so leitura)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 4. embaixador e candidato CONSEGUEM ler (positivo) — feed unico visivel a todos internos
DO $$
DECLARE v_count_emb int; v_count_cand int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count_emb FROM monitoramento_itens WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato_a'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count_cand FROM monitoramento_itens WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;

  INSERT INTO test_results(test, passed, detail) VALUES ('4. embaixador e candidato leem o feed (positivo)', v_count_emb=1 AND v_count_cand=1, 'emb='||v_count_emb||' cand='||v_count_cand);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. embaixador e candidato leem o feed (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 5. Isolamento cross-tenant: coord_campanha B nao ve item da campanha A
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM monitoramento_itens WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. isolamento cross-tenant', v_count = 0, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. isolamento cross-tenant', false, 'ERRO: '||SQLERRM);
END $$;

-- 6. Storage: papel liberado consegue subir print na propria pasta
DO $$
DECLARE v_path text;
BEGIN
  v_path := (SELECT id FROM fixture_ids WHERE name='camp_a')::text || '/print-teste.png';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('monitoramento', v_path, (SELECT id FROM fixture_ids WHERE name='user_redator_a'));
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('6. storage insert dentro da propria pasta (positivo)', true, 'path='||v_path);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('6. storage insert dentro da propria pasta (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 7. Storage: embaixador (sem permissao) nao consegue subir
DO $$
DECLARE v_path text;
BEGIN
  BEGIN
    v_path := (SELECT id FROM fixture_ids WHERE name='camp_a')::text || '/print-embaixador.png';
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('monitoramento', v_path, (SELECT id FROM fixture_ids WHERE name='user_embaixador_a'));
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('7. storage embaixador sem permissao', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('7. storage embaixador sem permissao', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM monitoramento_itens WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM territorios WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
