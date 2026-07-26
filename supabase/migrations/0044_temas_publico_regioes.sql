ALTER TABLE temas_campanha
    ADD COLUMN publicos_alvo TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN regioes_prioritarias TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN temas_campanha.publicos_alvo IS
    'Segmentos de público-alvo desse tema (ex.: idosos, jovens, empresários)';
COMMENT ON COLUMN temas_campanha.regioes_prioritarias IS
    'Regiões prioritárias desse tema (ex.: Zona Norte, Centro, Vila X)';
