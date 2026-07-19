CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_coord_a'), ('user_mkt_a'), ('user_candidato_a'), ('user_coord_b');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Apoiadores A', 'deputado estadual', 'PE', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Apoiadores B', 'deputado estadual', 'PE', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_marketing', 'Mkt A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_mkt_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'candidato', 'Candidato A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_candidato_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_b' AND c.name='camp_b';

-- Cidadao fixture (campanha A) pra testar o vinculo. Guarda o id em fixture_ids (superuser,
-- antes de qualquer troca de papel) porque coord_marketing não consegue ler cidadaos sob RLS —
-- uma subquery direta a cidadaos dentro do teste de coord_marketing sempre voltaria NULL,
-- mascarando o que o teste realmente quer verificar (o trigger de separação de poder).
INSERT INTO fixture_ids (name) VALUES ('cidadao_fixture_a');
INSERT INTO cidadaos (id, campanha_id, nome, whatsapp, origem_cadastro)
SELECT (SELECT id FROM fixture_ids WHERE name='cidadao_fixture_a'), (SELECT id FROM fixture_ids WHERE name='camp_a'), 'Cidadao Fixture A', '+5581900000001', 'app';

-- 1. coord_marketing cria apoiador sem cidadao_id (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO apoiadores (campanha_id, nome, telefone, formas_ajuda)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Apoiador Teste 1', '+5581911112222', ARRAY['transporte','tempo_voluntario']::forma_ajuda_apoiador[])
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. coord_marketing cria apoiador sem cidadao_id (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. coord_marketing cria apoiador sem cidadao_id (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. coord_marketing NAO consegue criar apoiador COM cidadao_id
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO apoiadores (campanha_id, nome, telefone, cidadao_id)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Apoiador Indevido', '+5581911112223',
            (SELECT id FROM fixture_ids WHERE name='cidadao_fixture_a'));
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. coord_marketing NAO vincula cidadao (bloqueado)', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. coord_marketing NAO vincula cidadao (bloqueado)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 3. coord_campanha cria apoiador COM cidadao_id da propria campanha (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO apoiadores (campanha_id, nome, telefone, cidadao_id, formas_ajuda, detalhe_ajuda)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Cidadao Fixture A', '+5581900000001',
          (SELECT id FROM fixture_ids WHERE name='cidadao_fixture_a'), ARRAY['redes_sociais']::forma_ajuda_apoiador[], 'Ajuda nas redes')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. coord_campanha vincula cidadao propria campanha (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. coord_campanha vincula cidadao propria campanha (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 4. cidadao_id de campanha diferente eh rejeitado
DO $$
DECLARE v_cidadao_b uuid;
BEGIN
  INSERT INTO cidadaos (campanha_id, nome, whatsapp, origem_cadastro)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_b'), 'Cidadao Fixture B', '+5581900000002', 'app')
  RETURNING id INTO v_cidadao_b;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO apoiadores (campanha_id, nome, telefone, cidadao_id)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Cross Tenant', '+5581911112224', v_cidadao_b);
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('4. cidadao_id de outra campanha rejeitado', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('4. cidadao_id de outra campanha rejeitado', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 5. candidato le apoiadores (positivo) mas nao cria
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato_a'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM apoiadores WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. candidato le apoiadores (positivo)', v_count >= 2, 'visiveis='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. candidato le apoiadores (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 6. candidato NAO cria apoiador
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_candidato_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO apoiadores (campanha_id, nome, telefone) VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Indevido', '+5581911112225');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. candidato nao cria apoiador', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. candidato nao cria apoiador', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 7. isolamento cross-tenant
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM apoiadores WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. isolamento cross-tenant', v_count = 0, 'visiveis='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. isolamento cross-tenant', false, 'ERRO: '||SQLERRM);
END $$;

-- 8. coord_marketing NAO consegue alterar (adicionar) cidadao_id via UPDATE num apoiador existente
DO $$
DECLARE v_apoiador uuid;
BEGIN
  SELECT id INTO v_apoiador FROM apoiadores WHERE campanha_id=(SELECT id FROM fixture_ids WHERE name='camp_a') AND cidadao_id IS NULL LIMIT 1;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE apoiadores SET cidadao_id = (SELECT id FROM fixture_ids WHERE name='cidadao_fixture_a') WHERE id = v_apoiador;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('8. coord_marketing NAO altera cidadao_id via UPDATE', false, 'atualizou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('8. coord_marketing NAO altera cidadao_id via UPDATE', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM apoiadores WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM cidadaos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
