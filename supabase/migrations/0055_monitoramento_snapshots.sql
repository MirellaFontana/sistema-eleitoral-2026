-- Snapshots de buscas automáticas periódicas de monitoramento
create table monitoramento_snapshots (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  total_mencoes int not null default 0,
  resultados_brutos jsonb not null default '[]',
  analise_ia jsonb,
  provedor_ia text,
  erro text,
  created_at timestamptz not null default now()
);

create index idx_snapshots_campanha_created
  on monitoramento_snapshots (campanha_id, created_at desc);

alter table monitoramento_snapshots enable row level security;

create policy "snapshot_select_campanha"
  on monitoramento_snapshots for select
  using (
    campanha_id in (
      select campanha_id from usuarios_internos where id = auth.uid()
    )
  );
