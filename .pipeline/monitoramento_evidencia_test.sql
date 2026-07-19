CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_advogado_a'), ('user_coord_campanha_b');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Evidencia A', 'deputado estadual', 'SP', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Evidencia B', 'deputado estadual', 'SP', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'advogado_responsavel', 'Advogado A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_advogado_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_b' AND c.name='camp_b';

-- 1. Insere item de ameaça com hash (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO monitoramento_itens (campanha_id, descricao, categoria, gravidade, captura_path, hash_evidencia, hash_calculado_em)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Video suspeito de deepfake', 'deepfake_suspeito', 'alta', 'camp_a/evidencia1.mp4', repeat('a',64), now())
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. insere item de ameaca com hash (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. insere item de ameaca com hash (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. Hash em categoria fora de ameaca eh bloqueado (CHECK)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO monitoramento_itens (campanha_id, descricao, categoria, hash_evidencia, hash_calculado_em)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Mencao neutra com hash indevido', 'mencao_neutra', repeat('b',64), now());
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. hash fora de categoria de ameaca bloqueado (CHECK)', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. hash fora de categoria de ameaca bloqueado (CHECK)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 3. hash_evidencia sem hash_calculado_em eh bloqueado (CHECK par completo)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO monitoramento_itens (campanha_id, descricao, categoria, hash_evidencia)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Par incompleto', 'ameaca_juridica', repeat('c',64));
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('3. hash sem timestamp bloqueado (CHECK)', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('3. hash sem timestamp bloqueado (CHECK)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 4. UPDATE de status em item lacrado funciona (positivo)
DO $$
DECLARE v_id uuid; v_status status_monitoramento;
BEGIN
  SELECT id INTO v_id FROM monitoramento_itens WHERE campanha_id=(SELECT id FROM fixture_ids WHERE name='camp_a') AND hash_evidencia IS NOT NULL LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE monitoramento_itens SET status='em_analise' WHERE id=v_id RETURNING status INTO v_status;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. UPDATE status em item lacrado (positivo)', v_status='em_analise', 'status='||v_status);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. UPDATE status em item lacrado (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 5. UPDATE de descricao em item lacrado eh bloqueado (trigger)
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM monitoramento_itens WHERE campanha_id=(SELECT id FROM fixture_ids WHERE name='camp_a') AND hash_evidencia IS NOT NULL LIMIT 1;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE monitoramento_itens SET descricao='tentando reescrever a evidencia' WHERE id=v_id;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('5. UPDATE descricao em item lacrado bloqueado (trigger)', false, 'atualizou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('5. UPDATE descricao em item lacrado bloqueado (trigger)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 6. UPDATE de captura_path em item lacrado eh bloqueado (trigger)
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM monitoramento_itens WHERE campanha_id=(SELECT id FROM fixture_ids WHERE name='camp_a') AND hash_evidencia IS NOT NULL LIMIT 1;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE monitoramento_itens SET captura_path='camp_a/trocado.mp4' WHERE id=v_id;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. UPDATE captura_path em item lacrado bloqueado (trigger)', false, 'atualizou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. UPDATE captura_path em item lacrado bloqueado (trigger)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 7. UPDATE de categoria pra fora do escopo de ameaca em item lacrado eh bloqueado (CHECK)
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM monitoramento_itens WHERE campanha_id=(SELECT id FROM fixture_ids WHERE name='camp_a') AND hash_evidencia IS NOT NULL LIMIT 1;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE monitoramento_itens SET categoria='mencao_neutra' WHERE id=v_id;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('7. UPDATE categoria pra fora do escopo bloqueado (CHECK)', false, 'atualizou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('7. UPDATE categoria pra fora do escopo bloqueado (CHECK)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 8. Item de ameaca sem captura fica sem hash (positivo, nao forca prova)
DO $$
DECLARE v_id uuid; v_hash text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO monitoramento_itens (campanha_id, descricao, categoria)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Ameaca relatada sem print', 'ameaca_juridica')
  RETURNING id, hash_evidencia INTO v_id, v_hash;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('8. item de ameaca sem captura fica sem hash (positivo)', v_id IS NOT NULL AND v_hash IS NULL, 'hash='||coalesce(v_hash,'null'));
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('8. item de ameaca sem captura fica sem hash (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 9. Isolamento cross-tenant (dossie): outra campanha nao ve os itens lacrados desta
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM monitoramento_itens WHERE campanha_id=(SELECT id FROM fixture_ids WHERE name='camp_a') AND hash_evidencia IS NOT NULL;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('9. isolamento cross-tenant no dossie', v_count=0, 'linhas visiveis='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('9. isolamento cross-tenant no dossie', false, 'ERRO: '||SQLERRM);
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM monitoramento_itens WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
