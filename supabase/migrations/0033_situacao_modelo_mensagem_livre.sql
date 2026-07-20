-- Permite cadastrar modelos de mensagem para situações além das 10 originais — o campo
-- `situacao` era um enum fechado (situacao_modelo_mensagem), mas diferente de papel_usuario ele
-- não tem nenhuma regra de RLS amarrada ao valor: é só um rótulo de agrupamento na tela. Por
-- isso a conversão pra texto livre é segura e não exige duas migrations (enum + policies) como
-- foi necessário para papéis — não há policy nenhuma que dependa do valor de `situacao`.

ALTER TABLE modelos_mensagem
    ALTER COLUMN situacao TYPE TEXT USING situacao::TEXT;

DROP TYPE situacao_modelo_mensagem;
