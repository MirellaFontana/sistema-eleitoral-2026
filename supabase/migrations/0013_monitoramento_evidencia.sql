-- Módulo 3 — Jurídico: Escudo antideepfake (ref. .pipeline/specs.md [2026-07-15]
-- "Módulo 3 — Jurídico: Escudo antideepfake"). Em vez de uma tabela evento_ameaca separada
-- (como a especificação original desenha), estende monitoramento_itens com prova forense —
-- decisão do usuário, para não rastrear a mesma menção em duas tabelas.

ALTER TABLE monitoramento_itens
    ADD COLUMN hash_evidencia TEXT,        -- SHA-256 hex (64 chars) da captura, calculado no cliente
    ADD COLUMN hash_calculado_em TIMESTAMPTZ; -- carimbo de data/hora do cálculo (local à inserção, não autoridade externa)

-- Hash só faz sentido nas categorias de ameaça (mesmas 3 que já têm gravidade). Revalidado em
-- todo UPDATE — impede também "esvaziar" a prova trocando a categoria depois de lacrada.
ALTER TABLE monitoramento_itens
    ADD CONSTRAINT hash_so_para_ameaca CHECK (
        hash_evidencia IS NULL OR categoria IN ('deepfake_suspeito', 'ameaca_juridica', 'gestao_crise')
    );

-- Os dois campos existem juntos ou nenhum dos dois.
ALTER TABLE monitoramento_itens
    ADD CONSTRAINT hash_par_completo CHECK ((hash_evidencia IS NULL) = (hash_calculado_em IS NULL));

-- Imutabilidade pós-lacre: uma vez com hash_evidencia preenchido, descricao/url/captura_path/hash_*
-- não podem mais mudar — é a garantia de "prova de existência mesmo após remoção" do conteúdo
-- original. status/gravidade continuam editáveis (o item evolui de novo->em_analise->resolvido
-- sem tocar na evidência). Construído mesmo sem existir ainda tela de edição de monitoramento_itens,
-- mesma disciplina de "trigger antes da UI que dependeria dele" já usada no resto do projeto.
CREATE OR REPLACE FUNCTION bloquear_edicao_evidencia_lacrada()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.hash_evidencia IS NOT NULL THEN
        IF NEW.descricao IS DISTINCT FROM OLD.descricao
           OR NEW.url IS DISTINCT FROM OLD.url
           OR NEW.captura_path IS DISTINCT FROM OLD.captura_path
           OR NEW.hash_evidencia IS DISTINCT FROM OLD.hash_evidencia
           OR NEW.hash_calculado_em IS DISTINCT FROM OLD.hash_calculado_em
        THEN
            RAISE EXCEPTION 'Evidência lacrada em %: descrição, url, captura e hash não podem ser alterados. Só status/gravidade seguem editáveis.', OLD.hash_calculado_em;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_monitoramento_evidencia_imutavel
    BEFORE UPDATE ON monitoramento_itens
    FOR EACH ROW EXECUTE FUNCTION bloquear_edicao_evidencia_lacrada();
