-- Adiciona prazo e devolutiva às demandas (requisito da spec seção 9)
ALTER TABLE demandas_observadas
    ADD COLUMN prazo DATE,
    ADD COLUMN devolutiva TEXT;
