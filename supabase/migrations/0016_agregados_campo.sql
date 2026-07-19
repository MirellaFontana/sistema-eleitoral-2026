-- Agregados do campo (ref. .pipeline/specs.md [2026-07-15] "Remodelagem do campo").
-- Marketing/jurídico não leem linhas de cidadaos (RLS da 0006), mas a tela de lideranças e o
-- mapa precisam de CONTAGENS. Estas funções são SECURITY DEFINER e devolvem só agregados da
-- própria campanha (via current_campanha_id()) — nunca dado nominal. search_path fixo, mesmo
-- padrão das helpers da 0001.

CREATE OR REPLACE FUNCTION agregados_liderancas()
RETURNS TABLE(lideranca_id UUID, cadastros BIGINT, cadastros_mes BIGINT, apoiadores BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT c.lideranca_id,
           count(*),
           count(*) FILTER (WHERE c.created_at >= date_trunc('month', now())),
           count(*) FILTER (WHERE c.circulo = 'quente')
    FROM cidadaos c
    WHERE c.campanha_id = current_campanha_id() AND c.lideranca_id IS NOT NULL
    GROUP BY c.lideranca_id;
$$;

CREATE OR REPLACE FUNCTION agregados_territorios()
RETURNS TABLE(territorio_id UUID, cadastros BIGINT, cadastros_mes BIGINT, apoiadores BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT c.territorio_id,
           count(*),
           count(*) FILTER (WHERE c.created_at >= date_trunc('month', now())),
           count(*) FILTER (WHERE c.circulo = 'quente')
    FROM cidadaos c
    WHERE c.campanha_id = current_campanha_id() AND c.territorio_id IS NOT NULL
    GROUP BY c.territorio_id;
$$;

CREATE OR REPLACE FUNCTION agregados_campanha()
RETURNS TABLE(cadastros BIGINT, cadastros_mes BIGINT, apoiadores BIGINT, apoiadores_mes BIGINT, sem_coordenada BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT count(*),
           count(*) FILTER (WHERE c.created_at >= date_trunc('month', now())),
           count(*) FILTER (WHERE c.circulo = 'quente'),
           count(*) FILTER (WHERE c.circulo = 'quente' AND c.created_at >= date_trunc('month', now())),
           count(*) FILTER (WHERE c.geom IS NULL AND (c.territorio_id IS NULL OR t.centro IS NULL))
    FROM cidadaos c
    LEFT JOIN territorios t ON t.id = c.territorio_id
    WHERE c.campanha_id = current_campanha_id();
$$;

-- Círculos do mapa: só territórios com centro definido, com contagens prontas.
CREATE OR REPLACE FUNCTION mapa_territorios()
RETURNS TABLE(territorio_id UUID, bairro TEXT, cidade TEXT, lat FLOAT8, lng FLOAT8, cadastros BIGINT, apoiadores BIGINT, liderancas BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT t.id, t.nome_bairro, t.cidade,
           ST_Y(t.centro::geometry), ST_X(t.centro::geometry),
           (SELECT count(*) FROM cidadaos c WHERE c.territorio_id = t.id),
           (SELECT count(*) FROM cidadaos c WHERE c.territorio_id = t.id AND c.circulo = 'quente'),
           (SELECT count(*) FROM liderancas l WHERE l.territorio_id = t.id)
    FROM territorios t
    WHERE t.campanha_id = current_campanha_id() AND t.centro IS NOT NULL;
$$;

-- Pontos de eleitores com coordenada própria (legado da coleta em campo): SÓ coordenadas,
-- sem nome/contato — vira ponto anônimo no mapa.
CREATE OR REPLACE FUNCTION mapa_eleitores()
RETURNS TABLE(lat FLOAT8, lng FLOAT8)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT ST_Y(c.geom::geometry), ST_X(c.geom::geometry)
    FROM cidadaos c
    WHERE c.campanha_id = current_campanha_id() AND c.geom IS NOT NULL;
$$;

-- Execução: só authenticated (anon nem enxerga contagem).
REVOKE ALL ON FUNCTION agregados_liderancas() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION agregados_territorios() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION agregados_campanha() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mapa_territorios() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mapa_eleitores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION agregados_liderancas(), agregados_territorios(), agregados_campanha(), mapa_territorios(), mapa_eleitores() TO authenticated;
