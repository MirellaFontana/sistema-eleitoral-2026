CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'),
 ('user_coord_campanha'), ('user_candidato'),
 ('user_advogado_resp'), ('user_assist_juridico'),
 ('user_coord_marketing'), ('user_redator_marketing'),
 ('tema_a1'), ('cid_a1');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Teste Hierarquia', 'deputado estadual', 'SP', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome, exige_mfa)
SELECT u.id, c.id, 'coord_campanha', 'Coord Campanha', true FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome, exige_mfa)
SELECT u.id, c.id, 'candidato', 'Candidato', true FROM fixture_ids u, fixture_ids c WHERE u.name='user_candidato' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'advogado_responsavel', 'Advogado Resp' FROM fixture_ids u, fixture_ids c WHERE u.name='user_advogado_resp' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'assistente_juridico', 'Assistente Juridico' FROM fixture_ids u, fixture_ids c WHERE u.name='user_assist_juridico' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_marketing', 'Coord Marketing' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_marketing' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'redator_marketing', 'Redator Marketing' FROM fixture_ids u, fixture_ids c WHERE u.name='user_redator_marketing' AND c.name='camp_a';

INSERT INTO cidadaos (id, campanha_id, nome, whatsapp, origem_cadastro)
SELECT cid.id, c.id, 'Cidadao Teste', '+5511900000099', 'app' FROM fixture_ids cid, fixture_ids c WHERE cid.name='cid_a1' AND c.name='camp_a';

INSERT INTO temas_campanha (id, campanha_id, nome, ordem)
SELECT t.id, c.id, 'Tema Teste', 1 FROM fixture_ids t, fixture_ids c WHERE t.name='tema_a1' AND c.name='camp_a';

INSERT INTO log_auditoria (campanha_id, usuario_id, acao, tabela_afetada, entidade_id)
SELECT c.id, u.id, 'insert', 'cidadaos', (SELECT id FROM fixture_ids WHERE name='cid_a1')
FROM fixture_ids c, fixture_ids u WHERE c.name='camp_a' AND u.name='user_coord_campanha';

-- helper genérico pra rodar um SELECT count como um papel e comparar
DO $$
DECLARE v_count int;
BEGIN
  -- 1. candidato lê cidadaos (positivo, mudança de comportamento)
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM cidadaos WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. candidato le cidadaos (positivo)', v_count = 1, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. candidato le cidadaos (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

DO $$
DECLARE v_count int;
BEGIN
  -- 2. candidato lê consentimentos_lgpd (positivo)
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM log_auditoria WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2. candidato le log_auditoria (positivo)', v_count = 1, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2. candidato le log_auditoria (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 3. candidato NAO consegue inserir usuarios_internos (sem poder administrativo)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato'), 'aal','aal2')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO usuarios_internos (campanha_id, papel, nome) VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'embaixador', 'Nao deveria');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('3. candidato sem poder administrativo (usuarios_internos)', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('3. candidato sem poder administrativo (usuarios_internos)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 4. candidato NAO consegue atualizar campanhas
-- Nota de método: UPDATE bloqueado por RLS não gera exceção, só afeta 0 linhas silenciosamente —
-- checar SQLERRM sozinho dá falso negativo. Usa GET DIAGNOSTICS pra confirmar de verdade.
DO $$
DECLARE v_rows int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato'), 'aal','aal2')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE campanhas SET plano_contratado = 'hackeado' WHERE id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. candidato sem poder administrativo (campanhas)', v_rows = 0, 'linhas afetadas: '||v_rows);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. candidato sem poder administrativo (campanhas)', true, 'bloqueado: '||SQLERRM);
END $$;

-- 5. advogado_responsavel continua sem PII de cidadao (renomeado, mesmo comportamento)
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_resp'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM cidadaos WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. advogado_responsavel sem PII (renomeado)', v_count = 0, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. advogado_responsavel sem PII (renomeado)', false, 'ERRO: '||SQLERRM);
END $$;

-- 6. assistente_juridico tambem sem PII, mas le log_auditoria (bloco juridico)
DO $$
DECLARE v_cidadaos int; v_auditoria int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_assist_juridico'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_cidadaos FROM cidadaos WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  SELECT count(*) INTO v_auditoria FROM log_auditoria WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('6. assistente_juridico: sem PII, le auditoria', v_cidadaos=0 AND v_auditoria=1, 'cidadaos='||v_cidadaos||' auditoria='||v_auditoria);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('6. assistente_juridico: sem PII, le auditoria', false, 'ERRO: '||SQLERRM);
END $$;

-- 7. coord_marketing cria item na base de conhecimento (renomeado de coord_comunicacao)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_marketing'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO base_conhecimento_itens (campanha_id, tema_id, titulo, descricao)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), (SELECT id FROM fixture_ids WHERE name='tema_a1'), 'Item Marketing', 'texto')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. coord_marketing cria item (renomeado)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. coord_marketing cria item (renomeado)', false, 'ERRO: '||SQLERRM);
END $$;

-- 8. redator_marketing NAO consegue criar item (junior, so leitura)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_marketing'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO base_conhecimento_itens (campanha_id, tema_id, titulo, descricao)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), (SELECT id FROM fixture_ids WHERE name='tema_a1'), 'Nao deveria', 'x');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('8. redator_marketing sem edicao (junior)', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('8. redator_marketing sem edicao (junior)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 9. redator_marketing CONSEGUE ler a base de conhecimento (positivo)
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_marketing'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM base_conhecimento_itens WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('9. redator_marketing le base (positivo)', v_count >= 1, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('9. redator_marketing le base (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
-- log_auditoria é append-only por trigger — desabilita temporariamente só pra limpar a fixture.
ALTER TABLE log_auditoria DISABLE TRIGGER trg_log_auditoria_append_only;
DELETE FROM log_auditoria WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
ALTER TABLE log_auditoria ENABLE TRIGGER trg_log_auditoria_append_only;
DELETE FROM base_conhecimento_itens WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
DELETE FROM temas_campanha WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
DELETE FROM cidadaos WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
DELETE FROM usuarios_internos WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id = (SELECT id FROM fixture_ids WHERE name='camp_a');
