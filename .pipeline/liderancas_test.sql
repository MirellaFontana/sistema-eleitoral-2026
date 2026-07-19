CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_coord_a'), ('user_mkt_a'), ('user_redator_a'), ('user_candidato_a'), ('user_coord_b'),
 ('lid_a'), ('lid_b');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Liderancas A', 'deputado estadual', 'PE', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Liderancas B', 'deputado estadual', 'PE', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_marketing', 'Mkt A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_mkt_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'redator_marketing', 'Redator A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_redator_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'candidato', 'Candidato A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_candidato_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_b' AND c.name='camp_b';

-- Lideranças de fixture direto (superuser), uma por campanha, com id conhecido
INSERT INTO liderancas (id, campanha_id, nome, telefone, cidade, bairro)
SELECT l.id, c.id, 'Lid Fixture A', '(81) 90000-0001', 'Recife', 'Boa Viagem' FROM fixture_ids l, fixture_ids c WHERE l.name='lid_a' AND c.name='camp_a';
INSERT INTO liderancas (id, campanha_id, nome, telefone, cidade, bairro)
SELECT l.id, c.id, 'Lid Fixture B', '(81) 90000-0002', 'Olinda', 'Casa Caiada' FROM fixture_ids l, fixture_ids c WHERE l.name='lid_b' AND c.name='camp_b';

-- 1. coord_marketing cria lideranca (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO liderancas (campanha_id, nome, telefone, cidade, bairro)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Paula Teste', '(81) 99100-1122', 'Recife', 'Centro')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. coord_marketing cria lideranca (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. coord_marketing cria lideranca (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. candidato NAO cria lideranca
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO liderancas (campanha_id, nome) VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Invasor');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. candidato nao cria lideranca', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. candidato nao cria lideranca', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 3. isolamento cross-tenant (liderancas/metas/tarefas)
DO $$
DECLARE v_lid int; v_metas int; v_tarefas int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_lid FROM liderancas WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  SELECT count(*) INTO v_metas FROM metas WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  SELECT count(*) INTO v_tarefas FROM tarefas WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. isolamento cross-tenant (3 tabelas)', v_lid=0 AND v_metas=0 AND v_tarefas=0, 'lid='||v_lid||' metas='||v_metas||' tarefas='||v_tarefas);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. isolamento cross-tenant (3 tabelas)', false, 'ERRO: '||SQLERRM);
END $$;

-- 4. coord_campanha digita cidadao (origem formulario_lideranca, lideranca propria) — positivo
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO cidadaos (campanha_id, nome, whatsapp, origem_cadastro, lideranca_id)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Eleitor Formulario', '+5581911110001', 'formulario_lideranca', (SELECT id FROM fixture_ids WHERE name='lid_a'))
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. coord digita cidadao com lideranca propria (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. coord digita cidadao com lideranca propria (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 5. lideranca de OUTRA campanha eh rejeitada (EXISTS sob RLS)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO cidadaos (campanha_id, nome, whatsapp, origem_cadastro, lideranca_id)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Eleitor Cross', '+5581911110002', 'formulario_lideranca', (SELECT id FROM fixture_ids WHERE name='lid_b'));
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('5. lideranca de outra campanha rejeitada', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('5. lideranca de outra campanha rejeitada', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 6. origem formulario_lideranca SEM lideranca_id rejeitada (CHECK)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO cidadaos (campanha_id, nome, whatsapp, origem_cadastro)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Eleitor Sem Lid', '+5581911110003', 'formulario_lideranca');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. formulario sem lideranca_id rejeitado (CHECK)', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. formulario sem lideranca_id rejeitado (CHECK)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 7. coord_marketing NAO digita cidadao (modelo de PII preservado)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO cidadaos (campanha_id, nome, whatsapp, origem_cadastro, lideranca_id)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Eleitor Mkt', '+5581911110004', 'formulario_lideranca', (SELECT id FROM fixture_ids WHERE name='lid_a'));
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('7. coord_marketing nao digita cidadao', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('7. coord_marketing nao digita cidadao', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 8. meta geral criada por coord_marketing (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO metas (campanha_id, tipo, periodo, alvo_cadastros, alvo_apoiadores)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'geral', 'total', 6000, 1500)
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('8. meta geral criada (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('8. meta geral criada (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 9. meta tipo lideranca sem lideranca_id rejeitada (CHECK)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO metas (campanha_id, tipo, alvo_cadastros)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'lideranca', 100);
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('9. meta lideranca sem FK rejeitada (CHECK)', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('9. meta lideranca sem FK rejeitada (CHECK)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 10. redator NAO deleta meta (0 linhas afetadas); coord_marketing deleta (1 linha)
DO $$
DECLARE v_meta uuid; v_del1 int; v_del2 int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO metas (campanha_id, tipo, alvo_cadastros)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'geral', 123)
  RETURNING id INTO v_meta;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM metas WHERE id = v_meta;
  GET DIAGNOSTICS v_del1 = ROW_COUNT;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM metas WHERE id = v_meta;
  GET DIAGNOSTICS v_del2 = ROW_COUNT;
  RESET ROLE;

  INSERT INTO test_results(test, passed, detail) VALUES ('10. DELETE meta: redator=0, coord_marketing=1', v_del1=0 AND v_del2=1, 'redator='||v_del1||' mkt='||v_del2);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('10. DELETE meta: redator=0, coord_marketing=1', false, 'ERRO: '||SQLERRM);
END $$;

-- 11. redator cria tarefa (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO tarefas (campanha_id, titulo, responsavel, prazo)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Preparar material comicio', 'Comunicação', '2026-07-20')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('11. redator cria tarefa (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('11. redator cria tarefa (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 12. candidato NAO cria tarefa
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO tarefas (campanha_id, titulo, responsavel)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Tarefa indevida', 'Candidato');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('12. candidato nao cria tarefa', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('12. candidato nao cria tarefa', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 13. DELETE tarefa: redator=0 linhas, coord_campanha=1 linha
DO $$
DECLARE v_tarefa uuid; v_del1 int; v_del2 int;
BEGIN
  SELECT id INTO v_tarefa FROM tarefas WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a') LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM tarefas WHERE id = v_tarefa;
  GET DIAGNOSTICS v_del1 = ROW_COUNT;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM tarefas WHERE id = v_tarefa;
  GET DIAGNOSTICS v_del2 = ROW_COUNT;
  RESET ROLE;

  INSERT INTO test_results(test, passed, detail) VALUES ('13. DELETE tarefa: redator=0, coord=1', v_del1=0 AND v_del2=1, 'redator='||v_del1||' coord='||v_del2);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('13. DELETE tarefa: redator=0, coord=1', false, 'ERRO: '||SQLERRM);
END $$;

-- 14. candidato LE liderancas e tarefas (positivo — leitura liberada a todos)
DO $$
DECLARE v_lid int; v_tar int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato_a'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_lid FROM liderancas;
  SELECT count(*) INTO v_tar FROM tarefas;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('14. candidato le liderancas (positivo)', v_lid >= 2, 'liderancas visiveis='||v_lid||' tarefas='||v_tar);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('14. candidato le liderancas (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM cidadaos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM metas WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM tarefas WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM liderancas WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
