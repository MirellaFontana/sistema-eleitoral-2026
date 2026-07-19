-- Fix: gerar_alertas_ameaca_grave() rodava com o privilégio de quem inseriu o monitoramento_item
-- (role authenticated), então a própria RLS de `alertas` (sem policy de INSERT — de propósito,
-- só o trigger deveria escrever ali) bloqueava a fila de alertas de nascer. SECURITY DEFINER faz
-- o trigger rodar com o privilégio de quem criou a função, contornando a RLS só para esta escrita
-- interna do sistema — mesmo padrão já usado nas funções helper de RLS da migration 0001.
CREATE OR REPLACE FUNCTION gerar_alertas_ameaca_grave()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.categoria IN ('ameaca_juridica', 'deepfake_suspeito', 'gestao_crise') AND NEW.gravidade = 'alta' THEN
        INSERT INTO alertas (campanha_id, monitoramento_item_id, destinatario_papel)
        VALUES
            (NEW.campanha_id, NEW.id, 'advogado_responsavel'),
            (NEW.campanha_id, NEW.id, 'coord_campanha');
    END IF;
    RETURN NEW;
END;
$$;
