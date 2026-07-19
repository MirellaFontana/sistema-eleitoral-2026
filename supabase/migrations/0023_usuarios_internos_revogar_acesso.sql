-- Editar e revogar acesso de usuário interno (ref. specs.md [2026-07-18] "Editar e revogar acesso
-- de usuários internos — com achado de segurança").
--
-- ACHADO: usuarios_internos.status (ativo/revogado/expirado) existe desde a migration 0001 mas
-- nunca foi de fato aplicado — current_papel(), current_campanha_id() e current_territorio_id()
-- (usadas em praticamente toda policy de RLS do sistema) não filtravam por status. Marcar alguém
-- como "revogado" não bloqueava nada. Corrigindo aqui: as 3 funções passam a exigir status='ativo',
-- então usuário revogado/expirado some de toda checagem de RLS (efeito cascata pra todas as tabelas).

CREATE OR REPLACE FUNCTION current_campanha_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT campanha_id FROM usuarios_internos WHERE id = auth.uid() AND status = 'ativo';
$$;

CREATE OR REPLACE FUNCTION current_papel()
RETURNS papel_usuario LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT papel FROM usuarios_internos WHERE id = auth.uid() AND status = 'ativo';
$$;

CREATE OR REPLACE FUNCTION current_territorio_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT territorio_id FROM usuarios_internos WHERE id = auth.uid() AND status = 'ativo';
$$;
