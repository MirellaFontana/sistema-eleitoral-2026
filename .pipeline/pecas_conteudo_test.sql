CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_redator_a'), ('user_coordmkt_a'), ('user_advogado_a'), ('user_assistente_a'), ('user_coord_campanha_b');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Peças A', 'deputado estadual', 'SP', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Peças B', 'deputado estadual', 'SP', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'redator_marketing', 'Redator A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_redator_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_marketing', 'Coord Mkt A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coordmkt_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'advogado_responsavel', 'Advogado A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_advogado_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'assistente_juridico', 'Assistente A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_assistente_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_campanha_b' AND c.name='camp_b';

-- 1. redator_marketing cria rascunho com IA (positivo)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO pecas_conteudo (campanha_id, tipo, usou_ia, ferramenta, canal, criado_por)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'post', true, 'claude-sonnet-5-teste', 'instagram', (SELECT id FROM fixture_ids WHERE name='user_redator_a'))
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. redator_marketing cria rascunho com IA (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. redator_marketing cria rascunho com IA (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. redator_marketing NAO consegue setar rotulo_aplicado/aprovador_id diretamente
DO $$
DECLARE v_peca_id uuid;
BEGIN
  SELECT id INTO v_peca_id FROM pecas_conteudo
    WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a') AND criado_por = (SELECT id FROM fixture_ids WHERE name='user_redator_a')
    LIMIT 1;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE pecas_conteudo SET rotulo_aplicado = true, aprovador_id = (SELECT id FROM fixture_ids WHERE name='user_redator_a') WHERE id = v_peca_id;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. redator_marketing NAO auto-aprova', false, 'atualizou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('2. redator_marketing NAO auto-aprova', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 3. advogado_responsavel aprova e publica peça com IA + rótulo (positivo)
DO $$
DECLARE v_peca_id uuid; v_status status_peca_conteudo;
BEGIN
  SELECT id INTO v_peca_id FROM pecas_conteudo
    WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a') AND criado_por = (SELECT id FROM fixture_ids WHERE name='user_redator_a')
    LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE pecas_conteudo
    SET rotulo_aplicado = true,
        rotulo_texto = 'Conteúdo produzido com inteligência artificial',
        aprovador_id = (SELECT id FROM fixture_ids WHERE name='user_advogado_a'),
        status = 'publicado',
        publicado_em = now()
    WHERE id = v_peca_id
    RETURNING status INTO v_status;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. advogado_responsavel aprova e publica (positivo)', v_status = 'publicado', 'status='||v_status);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. advogado_responsavel aprova e publica (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 4. Peça com usou_ia=true e rotulo_aplicado=false NAO publica (CHECK)
DO $$
DECLARE v_peca_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO pecas_conteudo (campanha_id, tipo, usou_ia, canal, criado_por)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'whatsapp', true, 'whatsapp', (SELECT id FROM fixture_ids WHERE name='user_redator_a'))
  RETURNING id INTO v_peca_id;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_assistente_a'))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE pecas_conteudo SET status='publicado', aprovador_id=(SELECT id FROM fixture_ids WHERE name='user_assistente_a'), publicado_em=now() WHERE id = v_peca_id;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('4. IA sem rotulo NAO publica (CHECK)', false, 'publicou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('4. IA sem rotulo NAO publica (CHECK)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 5. Peça com rotulo_aplicado=true mas SEM aprovador_id NAO publica (CHECK)
DO $$
DECLARE v_peca_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO pecas_conteudo (campanha_id, tipo, usou_ia, canal, criado_por)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'post', true, 'site', (SELECT id FROM fixture_ids WHERE name='user_redator_a'))
  RETURNING id INTO v_peca_id;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coordmkt_a'))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE pecas_conteudo SET rotulo_aplicado = true, status='publicado', publicado_em=now() WHERE id = v_peca_id;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('5. rotulado sem aprovador_id NAO publica (CHECK)', false, 'publicou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('5. rotulado sem aprovador_id NAO publica (CHECK)', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 6. coord_marketing (não só jurídico) também aprova — decisão do usuário
DO $$
DECLARE v_peca_id uuid; v_status status_peca_conteudo;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coordmkt_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO pecas_conteudo (campanha_id, tipo, usou_ia, canal, criado_por)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'carrossel', false, 'facebook', (SELECT id FROM fixture_ids WHERE name='user_coordmkt_a'))
  RETURNING id INTO v_peca_id;
  UPDATE pecas_conteudo SET aprovador_id=(SELECT id FROM fixture_ids WHERE name='user_coordmkt_a'), status='publicado', publicado_em=now()
    WHERE id = v_peca_id RETURNING status INTO v_status;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('6. coord_marketing aprova peca sem IA (positivo)', v_status='publicado', 'status='||v_status);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('6. coord_marketing aprova peca sem IA (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 7. aprovador_id nao pode ser atribuido a outro usuario (nao o autor da UPDATE)
DO $$
DECLARE v_peca_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO pecas_conteudo (campanha_id, tipo, usou_ia, canal, criado_por)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'post', false, 'tiktok', (SELECT id FROM fixture_ids WHERE name='user_redator_a'))
  RETURNING id INTO v_peca_id;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_assistente_a'))::text, true);
    SET LOCAL ROLE authenticated;
    -- assistente tenta assinar aprovação em nome do advogado
    UPDATE pecas_conteudo SET aprovador_id = (SELECT id FROM fixture_ids WHERE name='user_advogado_a') WHERE id = v_peca_id;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('7. aprovador_id != auth.uid() eh bloqueado', false, 'atualizou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('7. aprovador_id != auth.uid() eh bloqueado', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 8. Janela de bloqueio: forçar dentro_janela_bloqueio()=true temporariamente
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION dentro_janela_bloqueio() RETURNS BOOLEAN LANGUAGE sql STABLE AS $f$ SELECT true; $f$;
END $$;

-- 8a. INSERT de peça nova com IA é bloqueado dentro da janela
DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO pecas_conteudo (campanha_id, tipo, usou_ia, canal, criado_por)
    VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'video', true, 'tv', (SELECT id FROM fixture_ids WHERE name='user_redator_a'));
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('8a. INSERT peca IA bloqueado na janela', false, 'inseriu sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('8a. INSERT peca IA bloqueado na janela', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 8b. Peça sem IA NÃO é afetada pela janela (positivo, mesmo com a janela forçada)
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_redator_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO pecas_conteudo (campanha_id, tipo, usou_ia, canal, criado_por)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'video', false, 'tv', (SELECT id FROM fixture_ids WHERE name='user_redator_a'))
  RETURNING id INTO v_id;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('8b. peca sem IA nao afetada pela janela (positivo)', v_id IS NOT NULL, 'id='||v_id);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('8b. peca sem IA nao afetada pela janela (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 8c. Publicar peça com IA já existente (rotulada, aprovada) é bloqueado dentro da janela
DO $$
DECLARE v_peca_id uuid;
BEGIN
  -- peça criada no teste 1, já com rótulo/aprovador do teste 3, mas ainda existe outra em rascunho: usar a do teste 1 antes de publicar (ela já foi publicada no teste 3).
  -- Cria uma nova peça com IA fora da janela não é possível agora (janela forçada) — usar update em uma existente com status ainda != publicado é inviável pois INSERT já bloqueia.
  -- Em vez disso, valida a trava diretamente: pega a peça do teste 1 (já publicada) e tenta popular publicado_em de novo não muda status, então testamos com uma peça criada ANTES da janela ser forçada: a peça do teste 5 (rascunho, usou_ia=true, sem status publicado ainda).
  SELECT id INTO v_peca_id FROM pecas_conteudo
    WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a') AND usou_ia = true AND status <> 'publicado'
    ORDER BY created_at DESC LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE pecas_conteudo SET rotulo_aplicado=true, rotulo_texto='r', aprovador_id=(SELECT id FROM fixture_ids WHERE name='user_advogado_a'), status='publicado', publicado_em=now()
      WHERE id = v_peca_id;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('8c. publicar peca IA existente bloqueado na janela', false, 'publicou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('8c. publicar peca IA existente bloqueado na janela', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- Restaura a função real da janela (definição idêntica à da migration 0012)
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION dentro_janela_bloqueio()
  RETURNS BOOLEAN LANGUAGE sql STABLE AS $f$
      SELECT now() >= '2026-10-01 00:00:00-03'::TIMESTAMPTZ
         AND now() <  '2026-10-05 00:00:00-03'::TIMESTAMPTZ;
  $f$;
END $$;

-- 9. Fora da janela (real, hoje), o mesmo fluxo de publicação funciona normalmente
DO $$
DECLARE v_peca_id uuid; v_status status_peca_conteudo;
BEGIN
  SELECT id INTO v_peca_id FROM pecas_conteudo
    WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a') AND usou_ia = true AND status <> 'publicado'
    ORDER BY created_at DESC LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE pecas_conteudo SET rotulo_aplicado=true, rotulo_texto='r', aprovador_id=(SELECT id FROM fixture_ids WHERE name='user_advogado_a'), status='publicado', publicado_em=now()
    WHERE id = v_peca_id
    RETURNING status INTO v_status;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('9. fora da janela, publicacao funciona (positivo)', v_status='publicado', 'status='||v_status);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('9. fora da janela, publicacao funciona (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 10. Isolamento cross-tenant
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_campanha_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM pecas_conteudo WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('10. isolamento cross-tenant', v_count = 0, 'linhas visiveis='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('10. isolamento cross-tenant', false, 'ERRO: '||SQLERRM);
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM pecas_conteudo WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
