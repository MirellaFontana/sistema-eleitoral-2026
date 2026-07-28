-- Permite alertas gerados pela análise IA (sem vínculo com monitoramento_itens).
alter table alertas
  alter column monitoramento_item_id drop not null;

alter table alertas
  add column texto_ia text,
  add column snapshot_id uuid references monitoramento_snapshots(id) on delete set null;

create index idx_alertas_snapshot on alertas (snapshot_id);

-- Política de INSERT: papéis internos podem criar alertas na própria campanha.
create policy alertas_insert on alertas
  for insert
  with check (
    campanha_id in (
      select campanha_id from usuarios_internos where id = auth.uid()
    )
  );
