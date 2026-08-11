-- log_auditoria.usuario_id referenciava usuarios_internos(id), impedindo
-- auditoria de ações de usuários que ainda não têm registro lá
-- (ex.: advogado externo criando primeira campanha).
-- Troca FK para auth.users(id) — qualquer usuário autenticado pode ser auditado.

ALTER TABLE log_auditoria DROP CONSTRAINT log_auditoria_usuario_id_fkey;
ALTER TABLE log_auditoria ADD CONSTRAINT log_auditoria_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES auth.users(id);
