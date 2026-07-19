CREATE TEMP TABLE fixture_ids (name text primary key, id uuid not null default gen_random_uuid());
CREATE TEMP TABLE test_results (seq serial, test text, passed boolean, detail text);
GRANT SELECT ON fixture_ids TO authenticated;
GRANT ALL ON test_results TO authenticated;

INSERT INTO fixture_ids (name) VALUES
 ('camp_a'), ('camp_b'),
 ('user_coord_a'), ('user_advogado_a'), ('user_mkt_a'), ('user_coord_b');

INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Alertas A', 'deputado estadual', 'PE', 'X', 'pro' FROM fixture_ids WHERE name='camp_a';
INSERT INTO campanhas (id, nome_candidato, cargo, uf, partido, plano_contratado)
SELECT id, 'Campanha Alertas B', 'deputado estadual', 'PE', 'Y', 'pro' FROM fixture_ids WHERE name='camp_b';

INSERT INTO auth.users (id, email)
SELECT id, name || '@teste.local' FROM fixture_ids WHERE name LIKE 'user_%';

INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'advogado_responsavel', 'Advogado A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_advogado_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_marketing', 'Mkt A' FROM fixture_ids u, fixture_ids c WHERE u.name='user_mkt_a' AND c.name='camp_a';
INSERT INTO usuarios_internos (id, campanha_id, papel, nome)
SELECT u.id, c.id, 'coord_campanha', 'Coord B' FROM fixture_ids u, fixture_ids c WHERE u.name='user_coord_b' AND c.name='camp_b';

-- 1. item de ameaca com gravidade ALTA gera 2 alertas automaticamente
DO $$
DECLARE v_item uuid; v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO monitoramento_itens (campanha_id, descricao, categoria, gravidade)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Deepfake grave de teste', 'deepfake_suspeito', 'alta')
  RETURNING id INTO v_item;
  SELECT count(*) INTO v_count FROM alertas WHERE monitoramento_item_id = v_item;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. gravidade alta gera 2 alertas (positivo)', v_count = 2, 'alertas='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('1. gravidade alta gera 2 alertas (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 2. item de ameaca com gravidade MEDIA NAO gera alerta
DO $$
DECLARE v_item uuid; v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO monitoramento_itens (campanha_id, descricao, categoria, gravidade)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Ameaca media de teste', 'ameaca_juridica', 'media')
  RETURNING id INTO v_item;
  SELECT count(*) INTO v_count FROM alertas WHERE monitoramento_item_id = v_item;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2. gravidade media NAO gera alerta', v_count = 0, 'alertas='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('2. gravidade media NAO gera alerta', false, 'ERRO: '||SQLERRM);
END $$;

-- 3. categoria NAO-ameaca com gravidade alta NAO gera alerta (gravidade só é setada em categorias de ameaça, mas confere mesmo assim via oportunidade_marketing sem gravidade)
DO $$
DECLARE v_item uuid; v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_a'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO monitoramento_itens (campanha_id, descricao, categoria)
  VALUES ((SELECT id FROM fixture_ids WHERE name='camp_a'), 'Oportunidade de marketing', 'oportunidade_marketing')
  RETURNING id INTO v_item;
  SELECT count(*) INTO v_count FROM alertas WHERE monitoramento_item_id = v_item;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. categoria nao-ameaca NAO gera alerta', v_count = 0, 'alertas='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('3. categoria nao-ameaca NAO gera alerta', false, 'ERRO: '||SQLERRM);
END $$;

-- 4. isolamento cross-tenant
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_coord_b'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM alertas WHERE campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a');
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. isolamento cross-tenant', v_count = 0, 'visiveis='||v_count);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('4. isolamento cross-tenant', false, 'ERRO: '||SQLERRM);
END $$;

-- 5. coord_marketing marca "lido" (positivo)
DO $$
DECLARE v_alerta uuid; v_lido timestamptz;
BEGIN
  SELECT a.id INTO v_alerta FROM alertas a JOIN monitoramento_itens m ON m.id = a.monitoramento_item_id
    WHERE m.campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a') AND a.destinatario_papel='coord_campanha' LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE alertas SET lido_em = now() WHERE id = v_alerta RETURNING lido_em INTO v_lido;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. coord_marketing marca lido (positivo)', v_lido IS NOT NULL, 'lido_em='||v_lido);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('5. coord_marketing marca lido (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 6. coord_marketing NAO marca encaminhamento
DO $$
DECLARE v_alerta uuid;
BEGIN
  SELECT a.id INTO v_alerta FROM alertas a JOIN monitoramento_itens m ON m.id = a.monitoramento_item_id
    WHERE m.campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a') AND a.destinatario_papel='advogado_responsavel' LIMIT 1;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_mkt_a'))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE alertas SET encaminhado_por = (SELECT id FROM fixture_ids WHERE name='user_mkt_a'), encaminhado_em = now() WHERE id = v_alerta;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. coord_marketing NAO marca encaminhamento', false, 'atualizou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('6. coord_marketing NAO marca encaminhamento', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 7. advogado_responsavel MARCA encaminhamento (positivo)
DO $$
DECLARE v_alerta uuid; v_enc timestamptz;
BEGIN
  SELECT a.id INTO v_alerta FROM alertas a JOIN monitoramento_itens m ON m.id = a.monitoramento_item_id
    WHERE m.campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a') AND a.destinatario_papel='advogado_responsavel' LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE alertas SET encaminhado_por = (SELECT id FROM fixture_ids WHERE name='user_advogado_a'), encaminhado_em = now(), encaminhado_nota = 'Protocolo nº teste 123'
    WHERE id = v_alerta RETURNING encaminhado_em INTO v_enc;
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. advogado marca encaminhamento (positivo)', v_enc IS NOT NULL, 'encaminhado_em='||v_enc);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO test_results(test, passed, detail) VALUES ('7. advogado marca encaminhamento (positivo)', false, 'ERRO: '||SQLERRM);
END $$;

-- 8. advogado NAO assina encaminhamento em nome de outro usuario
DO $$
DECLARE v_alerta uuid;
BEGIN
  SELECT a.id INTO v_alerta FROM alertas a JOIN monitoramento_itens m ON m.id = a.monitoramento_item_id
    WHERE m.campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a') AND a.destinatario_papel='coord_campanha' LIMIT 1;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM fixture_ids WHERE name='user_advogado_a'))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE alertas SET encaminhado_por = (SELECT id FROM fixture_ids WHERE name='user_coord_a'), encaminhado_em = now() WHERE id = v_alerta;
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('8. encaminhado_por != auth.uid() bloqueado', false, 'atualizou sem erro');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO test_results(test, passed, detail) VALUES ('8. encaminhado_por != auth.uid() bloqueado', true, 'bloqueado: '||SQLERRM);
  END;
END $$;

-- 9. status_envio nasce pendente_configuracao (sem provedor configurado ainda)
DO $$
DECLARE v_status status_envio_alerta;
BEGIN
  SELECT status_envio INTO v_status FROM alertas a JOIN monitoramento_itens m ON m.id = a.monitoramento_item_id
    WHERE m.campanha_id = (SELECT id FROM fixture_ids WHERE name='camp_a') LIMIT 1;
  INSERT INTO test_results(test, passed, detail) VALUES ('9. status_envio nasce pendente_configuracao', v_status = 'pendente_configuracao', 'status='||v_status);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results(test, passed, detail) VALUES ('9. status_envio nasce pendente_configuracao', false, 'ERRO: '||SQLERRM);
END $$;

SELECT seq, test, passed, detail FROM test_results ORDER BY seq;

-- Limpeza
DELETE FROM alertas WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM monitoramento_itens WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM usuarios_internos WHERE campanha_id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
DELETE FROM auth.users WHERE id IN (SELECT id FROM fixture_ids WHERE name LIKE 'user_%');
DELETE FROM campanhas WHERE id IN (SELECT id FROM fixture_ids WHERE name IN ('camp_a','camp_b'));
