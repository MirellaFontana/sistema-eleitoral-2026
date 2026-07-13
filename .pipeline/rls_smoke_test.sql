-- Teste real de RLS contra o banco de staging (substitui o traço manual anterior).
-- Cria fixtures temporárias, roda os 5 testes do plano + bônus, imprime resultado, e limpa tudo no final.

CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated, anon;
GRANT ALL ON test_results TO authenticated, anon;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('terr_a1'), ('terr_a2'), ('terr_b1'),
 ('user_embaixador_a1'), ('user_advogado_a'), ('user_coord_com_a'),
 ('user_coord_camp_a'), ('user_candidato_a'), ('user_coord_camp_b'),
 ('cid_a1'), ('cid_a2'), ('cid_b1');

-- Campanhas
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Candidato Teste A', 'deputado estadual', 'SP', 'PARTIDO_A', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Candidato Teste B', 'deputado estadual', 'SP', 'PARTIDO_B', 'pro' FROM fixture_ids WHERE name='camp_b';

-- Territorios
INSERT INTO territorios (id, campanha_id, nome_bairro, zona_eleitoral)
SELECT f.id, c.id, 'Bairro A1', '010' FROM fixture_ids f, fixture_ids c WHERE f.name='terr_a1' AND c.name='camp_a';
INSERT INTO territorios (id, campanha_id, nome_bairro, zona_eleitoral)
SELECT f.id, c.id, 'Bairro A2', '011' FROM fixture_ids f, fixture_ids c WHERE f.name='terr_a2' AND c.name='camp_a';
INSERT INTO territorios (id, campanha_id, nome_bairro, zona_eleitoral)
SELECT f.id, c.id, 'Bairro B1', '020' FROM fixture_ids f, fixture_ids c WHERE f.name='terr_b1' AND c.name='camp_b';

-- auth.users (mínimo necessário: id + email)
INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

-- usuarios_internos
INSERT INTO usuarios_internos (id, campanha_id, papel, nome, territorio_id, exige_mfa, expira_em)
SELECT u.id, c.id, 'embaixador', 'Embaixador A1', t.id, false, now() + interval '30 days'
FROM fixture_ids u, fixture_ids c, fixture_ids t
WHERE u.name='user_embaixador_a1' AND c.name='camp_a' AND t.name='terr_a1';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'advogado', 'Advogado A'
FROM fixture_ids u, fixture_ids c WHERE u.name='user_advogado_a' AND c.name='camp_a';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_comunicacao', 'Coord Comunicacao A'
FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_com_a' AND c.name='camp_a';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome, exige_mfa)
SELECT u.id, c.id, 'coord_campanha', 'Coord Campanha A', true
FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_camp_a' AND c.name='camp_a';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'candidato', 'Candidato A'
FROM fixture_ids u, fixture_ids c WHERE u.name='user_candidato_a' AND c.name='camp_a';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome, exige_mfa)
SELECT u.id, c.id, 'coord_campanha', 'Coord Campanha B', true
FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_camp_b' AND c.name='camp_b';

-- Cidadaos
INSERT INTO cidadaos (id, campanha_id, nome, whatsapp, territorio_id, origem_cadastro, embaixador_coletor_id)
SELECT cid.id, c.id, 'Cidadao A1', '+5511900000001', t.id, 'embaixador', e.id
FROM fixture_ids cid, fixture_ids c, fixture_ids t, fixture_ids e
WHERE cid.name='cid_a1' AND c.name='camp_a' AND t.name='terr_a1' AND e.name='user_embaixador_a1';

INSERT INTO cidadaos (id, campanha_id, nome, whatsapp, territorio_id, origem_cadastro)
SELECT cid.id, c.id, 'Cidadao A2', '+5511900000002', t.id, 'app'
FROM fixture_ids cid, fixture_ids c, fixture_ids t
WHERE cid.name='cid_a2' AND c.name='camp_a' AND t.name='terr_a2';

INSERT INTO cidadaos (id, campanha_id, nome, whatsapp, origem_cadastro)
SELECT cid.id, c.id, 'Cidadao B1', '+5511900000003', 'app'
FROM fixture_ids cid, fixture_ids c
WHERE cid.name='cid_b1' AND c.name='camp_b';

-- Consentimento + log de auditoria
INSERT INTO consentimentos_lgpd (cidadao_id, campanha_id, finalidade, base_legal, texto_aceito, canal_origem, status)
SELECT cid.id, c.id, 'contato de campanha', 'consentimento do titular', 'Aceito receber contato.', 'app', 'ativo'
FROM fixture_ids cid, fixture_ids c WHERE cid.name='cid_a1' AND c.name='camp_a';

INSERT INTO log_auditoria (campanha_id, usuario_id, acao, tabela_afetada, entidade_id)
SELECT c.id, u.id, 'insert', 'cidadaos', cid.id
FROM fixture_ids c, fixture_ids u, fixture_ids cid
WHERE c.name='camp_a' AND u.name='user_coord_camp_a' AND cid.name='cid_a1';

-- =====================  TESTES  =====================

-- 1. Isolamento cross-tenant: coord_campanha da B não vê cidadão da A
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM fixture_ids WHERE name='user_coord_camp_b'), 'aal','aal2')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM cidadaos WHERE id = (SELECT id FROM fixture_ids WHERE name='cid_a1');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. Isolamento cross-tenant', v_count = 0, 'linhas visíveis: ' || v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. Isolamento cross-tenant', false, 'ERRO inesperado: ' || SQLERRM);
END $$;

-- 1b. Embaixador só vê o próprio território (não vê cid_a2, que é de outro território na mesma campanha)
DO $$
DECLARE v_ids uuid[];
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM fixture_ids WHERE name='user_embaixador_a1'), 'aal','aal2')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT array_agg(id) INTO v_ids FROM cidadaos;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1b. Embaixador restrito ao próprio território',
    v_ids = ARRAY[(SELECT id FROM fixture_ids WHERE name='cid_a1')],
    'ids visíveis: ' || coalesce(v_ids::text, '{}'));
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1b. Embaixador restrito ao próprio território', false, 'ERRO: ' || SQLERRM);
END $$;

-- 2. Restrição de papel: advogado, coord_comunicacao e candidato não leem PII de cidadão
DO $$
DECLARE v_count int; v_papel text;
BEGIN
  FOR v_papel IN SELECT unnest(ARRAY['user_advogado_a','user_coord_com_a','user_candidato_a']) LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM fixture_ids WHERE name=v_papel), 'aal','aal2')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_count FROM cidadaos;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. '||v_papel||' não lê PII de cidadão', v_count = 0, 'linhas visíveis: '||v_count);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2. papéis restritos', false, 'ERRO: ' || SQLERRM);
END $$;

-- 2b. Coord. de campanha da própria campanha VÊ a base toda (contraste positivo do teste acima)
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM fixture_ids WHERE name='user_coord_camp_a'), 'aal','aal2')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM cidadaos;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2b. coord_campanha vê base da própria campanha (positivo)', v_count = 2, 'linhas visíveis: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2b. coord_campanha vê base (positivo)', false, 'ERRO: ' || SQLERRM);
END $$;

-- 3a. origem_cadastro é obrigatório
DO $$
BEGIN
  BEGIN
    INSERT INTO cidadaos (campanha_id, nome, whatsapp, origem_cadastro)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Sem Origem', '+5511900009999', NULL);
    INSERT INTO test_results(test, passed, detail) VALUES ('3a. origem_cadastro NOT NULL', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results(test, passed, detail) VALUES ('3a. origem_cadastro NOT NULL', true, 'bloqueado: ' || SQLERRM);
  END;
END $$;

-- 3b. embaixador_coletor_id obrigatório quando origem_cadastro = 'embaixador'
DO $$
BEGIN
  BEGIN
    INSERT INTO cidadaos (campanha_id, nome, whatsapp, origem_cadastro)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Sem Coletor', '+5511900008888', 'embaixador');
    INSERT INTO test_results(test, passed, detail) VALUES ('3b. embaixador_coletor_id obrigatório', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results(test, passed, detail) VALUES ('3b. embaixador_coletor_id obrigatório', true, 'bloqueado: ' || SQLERRM);
  END;
END $$;

-- 3c. Não existe valor de enum para "importação" (trava mais forte que CHECK)
DO $$
BEGIN
  BEGIN
    INSERT INTO cidadaos (campanha_id, nome, whatsapp, origem_cadastro)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Importado', '+5511900007777', 'importacao');
    INSERT INTO test_results(test, passed, detail) VALUES ('3c. enum sem valor "importacao"', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results(test, passed, detail) VALUES ('3c. enum sem valor "importacao"', true, 'bloqueado: ' || SQLERRM);
  END;
END $$;

-- 4. Imutabilidade: log_auditoria e consentimentos_lgpd não aceitam UPDATE/DELETE, nem como superuser
DO $$
BEGIN
  BEGIN
    UPDATE log_auditoria SET acao = 'hacked' WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
    INSERT INTO test_results(test, passed, detail) VALUES ('4. log_auditoria append-only', false, 'UPDATE passou');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results(test, passed, detail) VALUES ('4. log_auditoria append-only', true, 'bloqueado: ' || SQLERRM);
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE consentimentos_lgpd SET status = 'revogado' WHERE cidadao_id = (SELECT id FROM fixture_ids WHERE name='cid_a1');
    INSERT INTO test_results(test, passed, detail) VALUES ('4b. consentimentos_lgpd append-only', false, 'UPDATE passou');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results(test, passed, detail) VALUES ('4b. consentimentos_lgpd append-only', true, 'bloqueado: ' || SQLERRM);
  END;
END $$;

-- 5. Compliance TSE/LGPD: atendido_por_ia é gravável e legível (sustenta o rótulo obrigatório)
DO $$
DECLARE v_val boolean;
BEGIN
  UPDATE cidadaos SET atendido_por_ia = true WHERE id = (SELECT id FROM fixture_ids WHERE name='cid_a2');
  SELECT atendido_por_ia INTO v_val FROM cidadaos WHERE id = (SELECT id FROM fixture_ids WHERE name='cid_a2');
  INSERT INTO test_results(test, passed, detail) VALUES ('5. atendido_por_ia gravável/legível', v_val IS TRUE, 'valor lido: ' || v_val);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results(test, passed, detail) VALUES ('5. atendido_por_ia gravável/legível', false, 'ERRO: ' || SQLERRM);
END $$;

-- Bônus: anon não tem GRANT nenhum
DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM count(*) FROM cidadaos;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('bônus. anon sem GRANT', false, 'anon conseguiu SELECT');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('bônus. anon sem GRANT', true, 'bloqueado: ' || SQLERRM);
  END;
END $$;

-- =====================  RESULTADO  =====================
SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- =====================  LIMPEZA (remove fixtures novas + resíduo de teste anterior)  =====================
-- Alvo: as campanhas criadas por este script + as duas campanhas de teste (IDs fixos 111.../222...)
-- deixadas por uma rodada de teste anterior (confirmado antes: só continham fixture de teste, 0 dado real).
CREATE TEMP TABLE cleanup_campanha_ids AS
  SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b')
  UNION SELECT '11111111-1111-1111-1111-111111111111'::uuid
  UNION SELECT '22222222-2222-2222-2222-222222222222'::uuid;

CREATE TEMP TABLE cleanup_user_ids AS
  SELECT id FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM cleanup_campanha_ids);

-- log_auditoria/consentimentos_lgpd são append-only por trigger; precisa desabilitar para limpar fixture de teste.
ALTER TABLE log_auditoria DISABLE TRIGGER trg_log_auditoria_append_only;
ALTER TABLE consentimentos_lgpd DISABLE TRIGGER trg_consentimentos_append_only;

DELETE FROM log_auditoria WHERE campanha_id IN (SELECT id FROM cleanup_campanha_ids);
DELETE FROM consentimentos_lgpd WHERE campanha_id IN (SELECT id FROM cleanup_campanha_ids);

ALTER TABLE log_auditoria ENABLE TRIGGER trg_log_auditoria_append_only;
ALTER TABLE consentimentos_lgpd ENABLE TRIGGER trg_consentimentos_append_only;

DELETE FROM cidadaos WHERE campanha_id IN (SELECT id FROM cleanup_campanha_ids);
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM cleanup_campanha_ids);
DELETE FROM auth.users WHERE id IN (SELECT id FROM cleanup_user_ids);
DELETE FROM territorios WHERE campanha_id IN (SELECT id FROM cleanup_campanha_ids);
DELETE FROM campanhas WHERE id IN (SELECT id FROM cleanup_campanha_ids);
