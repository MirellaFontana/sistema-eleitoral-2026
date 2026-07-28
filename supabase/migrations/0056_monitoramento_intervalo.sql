-- Intervalo configurável para busca automática de monitoramento (em horas).
-- Padrão: 3 horas. Null = desativado.
alter table campanhas
  add column intervalo_monitoramento_horas int default 3;
