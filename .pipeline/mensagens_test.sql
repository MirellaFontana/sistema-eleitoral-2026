CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_coord_a'), ('user_mkt_a'), ('user_redator_a'), ('user_coord_b'),
 ('cidadao_a'), ('apoiador_a'), ('lideranca_a');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Mensagens A', 'deputado estadual', 'PE', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Mensagens B', 'deputado estadual', 'PE', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_marketing', 'Mkt A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_mkt_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'redator_marketing', 'Redator A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_redator_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_b' AND c.name='camp_b';

-- Fixtures de destinatário direto (superuser, ids conhecidos via fixture_ids)
INSERT INTO cidadaos (id, campanha_id, nome, whatsapp, origem_cadastro)
SELECT (SELECT id FROM fixture_ids WHERE name='cidadao_a'), (SELECT id FROM fixture_ids WHERE name='camp_a'), 'Cidadao Fixture', '+5581900000001', 'app';
INSERT INTO apoiadores (id, campanha_id, nome, telefone)
SELECT (SELECT id FROM fixture_ids WHERE name='apoiador_a'), (SELECT id FROM fixture_ids WHERE name='camp_a'), 'Apoiador Fixture', '+5581900000002';
INSERT INTO liderancas (id, campanha_id, nome, telefone)
SELECT (SELECT id FROM fixture_ids WHERE name='lideranca_a'), (SELECT id FROM fixture_ids WHERE name='camp_a'), 'Lideranca Fixture', '+5581900000003';

-- 1. coord_marketing manda mensagem pra apoiador (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO mensagens (campanha_id, tipo_destinatario, apoiador_id, conteudo)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'apoiador', (SELECT id FROM fixture_ids WHERE name='apoiador_a'), 'Obrigado por ajudar!')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. coord_marketing manda mensagem pra apoiador (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. coord_marketing manda mensagem pra apoiador (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. coord_marketing NAO manda mensagem pra cidadao
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO mensagens (campanha_id, tipo_destinatario, cidadao_id, conteudo)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'cidadao', (SELECT id FROM fixture_ids WHERE name='cidadao_a'), 'Indevido');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. coord_marketing NAO manda mensagem pra cidadao', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. coord_marketing NAO manda mensagem pra cidadao', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 3. coord_campanha manda mensagem pra cidadao (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO mensagens (campanha_id, tipo_destinatario, cidadao_id, conteudo)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'cidadao', (SELECT id FROM fixture_ids WHERE name='cidadao_a'), 'Ola, tudo bem?')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. coord_campanha manda mensagem pra cidadao (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. coord_campanha manda mensagem pra cidadao (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 4. redator_marketing NAO manda mensagem nenhuma (nao esta na lista de papeis liberados)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO mensagens (campanha_id, tipo_destinatario, lideranca_id, conteudo)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'lideranca', (SELECT id FROM fixture_ids WHERE name='lideranca_a'), 'Indevido');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('4. redator_marketing nao manda mensagem', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('4. redator_marketing nao manda mensagem', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 5. CHECK de coerencia: tipo='apoiador' com cidadao_id preenchido eh rejeitado
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO mensagens (campanha_id, tipo_destinatario, cidadao_id, apoiador_id, conteudo)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'apoiador', (SELECT id FROM fixture_ids WHERE name='cidadao_a'), (SELECT id FROM fixture_ids WHERE name='apoiador_a'), 'Incoerente');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('5. CHECK coerencia tipo/FK rejeitado', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('5. CHECK coerencia tipo/FK rejeitado', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 6. destinatario de outra campanha eh rejeitado (trigger)
DO $$
DECLARE v_apoiador_b uuid;
BEGIN
  INSERT INTO apoiadores (campanha_id, nome, telefone)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_b'), 'Apoiador B', '+5581900000004')
  RETURNING id INTO v_apoiador_b;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO mensagens (campanha_id, tipo_destinatario, apoiador_id, conteudo)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'apoiador', v_apoiador_b, 'Cross tenant');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. destinatario de outra campanha rejeitado', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. destinatario de outra campanha rejeitado', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 7. mensagem nasce pendente_configuracao
DO $$
DECLARE v_status status_mensagem;
BEGIN
  SELECT status INTO v_status FROM mensagens WHERE campanha_id=(SELECT id FROM fixture_ids WHERE name='camp_a') LIMIT 1;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. mensagem nasce pendente_configuracao', v_status='pendente_configuracao', 'status='||v_status);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results(test, passed, detail) VALUES ('7. mensagem nasce pendente_configuracao', false, 'ERRO: '||SQLERRM);
END $$;

-- 8. coord_marketing NAO consegue ler mensagem pra cidadao (mesmo sendo mensagem da propria campanha)
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM mensagens WHERE campanha_id=(SELECT id FROM fixture_ids WHERE name='camp_a') AND tipo_destinatario='cidadao';
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('8. coord_marketing NAO le mensagem pra cidadao', v_count=0, 'visiveis='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('8. coord_marketing NAO le mensagem pra cidadao', false, 'ERRO: '||SQLERRM);
END $$;

-- 9. coord_marketing LE mensagem pra apoiador (positivo)
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM mensagens WHERE campanha_id=(SELECT id FROM fixture_ids WHERE name='camp_a') AND tipo_destinatario='apoiador';
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('9. coord_marketing le mensagem pra apoiador (positivo)', v_count=1, 'visiveis='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('9. coord_marketing le mensagem pra apoiador (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 10. isolamento cross-tenant
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM mensagens WHERE campanha_id=(SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('10. isolamento cross-tenant', v_count=0, 'visiveis='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('10. isolamento cross-tenant', false, 'ERRO: '||SQLERRM);
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM mensagens WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM apoiadores WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM liderancas WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM cidadaos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
