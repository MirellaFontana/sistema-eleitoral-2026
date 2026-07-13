CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_coord_campanha_a'), ('user_coord_comunicacao_a'), ('user_embaixador_a'), ('user_coord_campanha_b'),
 ('tema_a1');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Teste BC A', 'deputado estadual', 'SP', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Teste BC B', 'deputado estadual', 'SP', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_comunicacao', 'Com A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_comunicacao_a' AND c.name='camp_a';

-- embaixador precisa de território já no INSERT (CHECK embaixador_precisa_territorio) — cria antes.
DO $$
DECLARE v_terr uuid;
BEGIN
  INSERT INTO territorios (campanha_id, nome_bairro) SELECT id, 'Bairro Teste BC' FROM fixture_ids WHERE name='camp_a' RETURNING id INTO v_terr;
  INSERT INTO usuarios_internos (id, campanha_id, papel, nome, territorio_id, expira_em)
  SELECT u.id, c.id, 'embaixador', 'Emb A', v_terr, now() + interval '30 days'
  FROM fixture_ids u, fixture_ids c WHERE u.name='user_embaixador_a' AND c.name='camp_a';
END $$;

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_b' AND c.name='camp_b';

INSERT INTO temas_campanha (id, campanha_id, nome, ordem)
SELECT t.id, c.id, 'Saúde', 1 FROM fixture_ids t, fixture_ids c WHERE t.name='tema_a1' AND c.name='camp_a';

-- 1. Isolamento cross-tenant: coord_campanha B não vê tema da campanha A
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM temas_campanha WHERE id = (SELECT id FROM fixture_ids WHERE name='tema_a1');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. isolamento cross-tenant (temas)', v_count=0, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. isolamento cross-tenant (temas)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. coord_comunicacao CONSEGUE criar item (diferente do padrão de PII das outras tabelas)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_comunicacao_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO base_conhecimento_itens (campanha_id, tema_id, titulo, descricao)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), (SELECT id FROM fixture_ids WHERE name='tema_a1'), 'Proposta 1', 'texto da proposta')
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2. coord_comunicacao cria item', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2. coord_comunicacao cria item', false, 'ERRO: '||SQLERRM);
END $$;

-- 3. Embaixador NÃO consegue criar item (só leitura)
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO base_conhecimento_itens (campanha_id, tema_id, titulo, descricao)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), (SELECT id FROM fixture_ids WHERE name='tema_a1'), 'Nao deveria', 'x');
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('3. embaixador nao cria item', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('3. embaixador nao cria item', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 3b. Mas embaixador CONSEGUE ler (select)
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM base_conhecimento_itens WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3b. embaixador le itens (positivo)', v_count >= 1, 'linhas: '||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3b. embaixador le itens (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 4. CHECK: item sem descricao e sem arquivo falha
DO $$
BEGIN
  BEGIN
    INSERT INTO base_conhecimento_itens (campanha_id, tema_id, titulo)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), (SELECT id FROM fixture_ids WHERE name='tema_a1'), 'Vazio');
    INSERT INTO test_results(test, passed, detail) VALUES ('4. CHECK descricao_ou_arquivo', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results(test, passed, detail) VALUES ('4. CHECK descricao_ou_arquivo', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 5. Storage: coord_campanha A consegue "subir" (insert em storage.objects) dentro da própria pasta
DO $$
DECLARE v_path text;
BEGIN
  v_path := (SELECT id FROM fixture_ids WHERE name='camp_a')::text || '/' || (SELECT id FROM fixture_ids WHERE name='tema_a1')::text || '/biografia.pdf';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('base-conhecimento', v_path, (SELECT id FROM fixture_ids WHERE name='user_coord_campanha_a'));
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. storage insert dentro da propria pasta (positivo)', true, 'path='||v_path);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. storage insert dentro da propria pasta (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 6. Storage: coord_campanha B NÃO consegue subir na pasta da campanha A
DO $$
DECLARE v_path text;
BEGIN
  BEGIN
    v_path := (SELECT id FROM fixture_ids WHERE name='camp_a')::text || '/' || (SELECT id FROM fixture_ids WHERE name='tema_a1')::text || '/invasao.pdf';
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_b'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('base-conhecimento', v_path, (SELECT id FROM fixture_ids WHERE name='user_coord_campanha_b'));
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. storage cross-tenant bloqueado', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. storage cross-tenant bloqueado', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 7. Storage: embaixador (papel sem permissão de escrita) não consegue subir, mesmo na própria pasta
DO $$
DECLARE v_path text;
BEGIN
  BEGIN
    v_path := (SELECT id FROM fixture_ids WHERE name='camp_a')::text || '/' || (SELECT id FROM fixture_ids WHERE name='tema_a1')::text || '/embaixador_nao_pode.pdf';
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_embaixador_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('base-conhecimento', v_path, (SELECT id FROM fixture_ids WHERE name='user_embaixador_a'));
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('7. storage embaixador sem permissao de escrita', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('7. storage embaixador sem permissao de escrita', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
-- storage.objects tem trigger protect_objects_delete (só permite DELETE via Storage API) e a role
-- de conexão da Management API não é dona da tabela pra desabilitar o trigger. Deixamos a única
-- linha de teste (metadado sem arquivo binário real por trás) órfã de propósito — não referencia
-- mais nenhuma campanha real depois da limpeza abaixo, sem custo prático.
DELETE FROM base_conhecimento_itens WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM temas_campanha WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM territorios WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
