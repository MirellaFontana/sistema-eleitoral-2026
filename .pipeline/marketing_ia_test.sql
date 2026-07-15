CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_coord_campanha_a'), ('user_redator_a'), ('user_embaixador_a'), ('user_coord_campanha_b');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Marketing A', 'deputado estadual', 'SP', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Marketing B', 'deputado estadual', 'SP', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'redator_marketing', 'Redator A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_redator_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_b' AND c.name='camp_b';

DO $$
DECLARE v_terr uuid;
BEGIN
  INSERT INTO territorios (campanha_id, nome_bairro) SELECT id, 'Bairro Teste Mkt' FROM fixture_ids WHERE name='camp_a' RETURNING id INTO v_terr;
  INSERT INTO usuarios_internos (id, campanha_id, papel, nome, territorio_id, expira_em)
  SELECT u.id, c.id, 'embaixador', 'Emb A', v_terr, now() + interval '30 days'
  FROM fixture_ids u, fixture_ids c WHERE u.name='user_embaixador_a' AND c.name='camp_a';
END $$;

-- 1. redator_marketing cria FAQ (positivo — diferente do padrão da base de conhecimento)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO faqs (campanha_id, pergunta, resposta)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Qual a proposta pra saúde?', 'Ampliar postos de saúde na zona leste.')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. redator_marketing cria FAQ (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. redator_marketing cria FAQ (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. embaixador NAO cria FAQ
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO faqs (campanha_id, pergunta, resposta) VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'x', 'y');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. embaixador nao cria FAQ', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. embaixador nao cria FAQ', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 3. embaixador CONSEGUE ler FAQ (positivo)
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM faqs WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. embaixador le FAQ (positivo)', v_count = 1, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. embaixador le FAQ (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 4. redator_marketing cria sugestao_conteudo (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO sugestoes_conteudo (campanha_id, formato, contexto_usado, modelo_ia, sugestao)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'whatsapp', 'Proposta de saúde X', 'claude-sonnet-5-teste', 'Sugestao de texto de teste')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. redator_marketing cria sugestao (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. redator_marketing cria sugestao (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 5. embaixador NAO cria sugestao_conteudo
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO sugestoes_conteudo (campanha_id, formato, contexto_usado, modelo_ia, sugestao)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'post', 'x', 'y', 'z');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('5. embaixador nao cria sugestao', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('5. embaixador nao cria sugestao', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 6. coord_campanha cria analise_campanha (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO analises_campanha (campanha_id, tipo, analise, modelo_ia)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'pontos_cegos', 'Analise de teste', 'claude-sonnet-5-teste')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('6. coord_campanha cria analise (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('6. coord_campanha cria analise (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 7. Isolamento cross-tenant nas 3 tabelas
DO $$
DECLARE v_faqs int; v_sug int; v_analises int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_faqs FROM faqs WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  SELECT count(*) INTO v_sug FROM sugestoes_conteudo WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  SELECT count(*) INTO v_analises FROM analises_campanha WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. isolamento cross-tenant (3 tabelas)', v_faqs=0 AND v_sug=0 AND v_analises=0, 'faqs='||v_faqs||' sug='||v_sug||' analises='||v_analises);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. isolamento cross-tenant (3 tabelas)', false, 'ERRO: '||SQLERRM);
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM faqs WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM sugestoes_conteudo WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM analises_campanha WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM territorios WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
