CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_coord_campanha_a'), ('user_embaixador_a'), ('user_coord_campanha_b'),
 ('tema_a1'), ('item_a1');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Arquivos A', 'deputado estadual', 'SP', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Arquivos B', 'deputado estadual', 'SP', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_b' AND c.name='camp_b';

DO $$
DECLARE v_terr uuid;
BEGIN
  INSERT INTO territorios (campanha_id, nome_bairro) SELECT id, 'Bairro Teste Arq' FROM fixture_ids WHERE name='camp_a' RETURNING id INTO v_terr;
  INSERT INTO usuarios_internos (id, campanha_id, papel, nome, territorio_id, expira_em)
  SELECT u.id, c.id, 'embaixador', 'Emb A', v_terr, now() + interval '30 days'
  FROM fixture_ids u, fixture_ids c WHERE u.name='user_embaixador_a' AND c.name='camp_a';
END $$;

INSERT INTO temas_campanha (id, campanha_id, nome, ordem)
SELECT t.id, c.id, 'Tema Teste Arq', 1 FROM fixture_ids t, fixture_ids c WHERE t.name='tema_a1' AND c.name='camp_a';

INSERT INTO base_conhecimento_itens (id, campanha_id, tema_id, titulo, descricao)
SELECT i.id, c.id, t.id, 'Item Teste', 'descricao original'
FROM fixture_ids i, fixture_ids c, fixture_ids t WHERE i.name='item_a1' AND c.name='camp_a' AND t.name='tema_a1';

-- 1. coord_campanha edita titulo/descricao do item (positivo)
DO $$
DECLARE v_rows int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_a'))::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE base_conhecimento_itens SET descricao = 'descricao editada' WHERE id = (SELECT id FROM fixture_ids WHERE name='item_a1');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. coord_campanha edita item (positivo)', v_rows = 1, 'linhas: '||v_rows);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. coord_campanha edita item (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. embaixador NAO edita item
DO $$
DECLARE v_rows int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE base_conhecimento_itens SET descricao = 'hackeado' WHERE id = (SELECT id FROM fixture_ids WHERE name='item_a1');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2. embaixador nao edita item', v_rows = 0, 'linhas afetadas: '||v_rows);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2. embaixador nao edita item', true, 'bloqueado: '||SQLERRM);
END $$;

-- 3. coord_campanha adiciona 2 arquivos no mesmo item (multiplos arquivos, positivo)
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO base_conhecimento_arquivos (item_id, campanha_id, arquivo_path, arquivo_nome_original)
  VALUES ((SELECT id FROM fixture_ids WHERE name='item_a1'), (SELECT id FROM fixture_ids WHERE name='camp_a'), 'a/b/lei.pdf', 'lei.pdf');
  INSERT INTO base_conhecimento_arquivos (item_id, campanha_id, arquivo_path, arquivo_nome_original)
  VALUES ((SELECT id FROM fixture_ids WHERE name='item_a1'), (SELECT id FROM fixture_ids WHERE name='camp_a'), 'a/b/resumo.pdf', 'resumo.pdf');
  SELECT count(*) INTO v_count FROM base_conhecimento_arquivos WHERE item_id = (SELECT id FROM fixture_ids WHERE name='item_a1');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. multiplos arquivos no mesmo item (positivo)', v_count = 2, 'arquivos: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. multiplos arquivos no mesmo item (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 4. embaixador NAO consegue adicionar arquivo
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO base_conhecimento_arquivos (item_id, campanha_id, arquivo_path, arquivo_nome_original)
    VALUES ((SELECT id FROM fixture_ids WHERE name='item_a1'), (SELECT id FROM fixture_ids WHERE name='camp_a'), 'a/b/naodeveria.pdf', 'x.pdf');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('4. embaixador nao adiciona arquivo', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('4. embaixador nao adiciona arquivo', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 5. Isolamento cross-tenant nos arquivos
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM base_conhecimento_arquivos WHERE item_id = (SELECT id FROM fixture_ids WHERE name='item_a1');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. isolamento cross-tenant (arquivos)', v_count = 0, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. isolamento cross-tenant (arquivos)', false, 'ERRO: '||SQLERRM);
END $$;

-- 6. coord_campanha remove 1 dos 2 arquivos (delete individual, positivo)
DO $$
DECLARE v_rows int; v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_a'))::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM base_conhecimento_arquivos WHERE item_id = (SELECT id FROM fixture_ids WHERE name='item_a1') AND arquivo_nome_original = 'resumo.pdf';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  SELECT count(*) INTO v_count FROM base_conhecimento_arquivos WHERE item_id = (SELECT id FROM fixture_ids WHERE name='item_a1');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('6. remove 1 arquivo, mantem o outro (positivo)', v_rows = 1 AND v_count = 1, 'removidos: '||v_rows||' restantes: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('6. remove 1 arquivo, mantem o outro (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 7. excluir o item cascateia pro arquivo restante
DO $$
DECLARE v_rows int; v_count_arquivo int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_a'))::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM base_conhecimento_itens WHERE id = (SELECT id FROM fixture_ids WHERE name='item_a1');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;
  SELECT count(*) INTO v_count_arquivo FROM base_conhecimento_arquivos WHERE item_id = (SELECT id FROM fixture_ids WHERE name='item_a1');
  INSERT INTO test_results(test, passed, detail) VALUES ('7. excluir item cascateia arquivo (positivo)', v_rows = 1 AND v_count_arquivo = 0, 'item removido: '||v_rows||' arquivos restantes: '||v_count_arquivo);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. excluir item cascateia arquivo (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM temas_campanha WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM territorios WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
