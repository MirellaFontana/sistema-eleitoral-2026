-- mapa_eleitores() só retornava cidadãos com geom próprio (captura de GPS no app de campo) —
-- na prática quase nenhum cidadão cadastrado pela tela normal tem isso, então "eleitores
-- cadastrados" nunca apareciam no mapa. Passa a cair de volta no centro do território (com
-- jitter pra não empilhar tudo no mesmo pixel) quando não há geom próprio. Adiciona o
-- equivalente para apoiadores e lideranças, que nunca tiveram camada no mapa.

CREATE OR REPLACE FUNCTION mapa_eleitores()
RETURNS TABLE(lat FLOAT8, lng FLOAT8)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT
        COALESCE(ST_Y(c.geom::geometry), ST_Y(t.centro::geometry) + (random() - 0.5) * 0.006),
        COALESCE(ST_X(c.geom::geometry), ST_X(t.centro::geometry) + (random() - 0.5) * 0.006)
    FROM cidadaos c
    LEFT JOIN territorios t ON t.id = c.territorio_id
    WHERE c.campanha_id = current_campanha_id()
      AND (c.geom IS NOT NULL OR t.centro IS NOT NULL);
$$;

CREATE OR REPLACE FUNCTION mapa_apoiadores()
RETURNS TABLE(lat FLOAT8, lng FLOAT8)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT
        ST_Y(t.centro::geometry) + (random() - 0.5) * 0.006,
        ST_X(t.centro::geometry) + (random() - 0.5) * 0.006
    FROM apoiadores a
    JOIN territorios t ON t.id = a.territorio_id
    WHERE a.campanha_id = current_campanha_id() AND t.centro IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION mapa_liderancas()
RETURNS TABLE(lat FLOAT8, lng FLOAT8)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT
        ST_Y(t.centro::geometry) + (random() - 0.5) * 0.006,
        ST_X(t.centro::geometry) + (random() - 0.5) * 0.006
    FROM liderancas l
    JOIN territorios t ON t.id = l.territorio_id
    WHERE l.campanha_id = current_campanha_id() AND t.centro IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION mapa_apoiadores() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mapa_liderancas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mapa_apoiadores(), mapa_liderancas() TO authenticated;
