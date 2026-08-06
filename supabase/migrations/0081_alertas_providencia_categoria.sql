-- Categoria do alerta (vinda da análise IA) + fluxo de ciência e providência.
ALTER TABLE alertas
  ADD COLUMN categoria TEXT,
  ADD COLUMN ciente_em TIMESTAMPTZ,
  ADD COLUMN ciente_por UUID REFERENCES usuarios_internos(id),
  ADD COLUMN providencia_em TIMESTAMPTZ,
  ADD COLUMN providencia_por UUID REFERENCES usuarios_internos(id),
  ADD COLUMN providencia_nota TEXT;

ALTER TABLE alertas
  ADD CONSTRAINT ciencia_coerente CHECK (
    (ciente_em IS NULL AND ciente_por IS NULL) OR
    (ciente_em IS NOT NULL AND ciente_por IS NOT NULL)
  ),
  ADD CONSTRAINT providencia_coerente CHECK (
    (providencia_em IS NULL AND providencia_por IS NULL) OR
    (providencia_em IS NOT NULL AND providencia_por IS NOT NULL)
  );

CREATE INDEX idx_alertas_categoria ON alertas (categoria);
CREATE INDEX idx_alertas_providencia ON alertas (providencia_em) WHERE providencia_em IS NULL;
