-- Econometria: costos fijos y variables del grow.
-- Los costos de insumos salen del inventario (tabla insumos, campo precio);
-- esta tabla agrega el resto de los costos del cultivo (alquiler, luz, agua,
-- nutrientes, sustrato, etc.) clasificados en fijos vs variables.

create table if not exists costos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'fijo'
    check (tipo in ('fijo','variable')),
  categoria text,
  monto numeric not null default 0,
  -- como se repite el costo, para normalizar a un equivalente mensual
  periodicidad text not null default 'mensual'
    check (periodicidad in ('unico','mensual','bimestral','por_ciclo','anual')),
  cantidad numeric default 1,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_costos_tipo on costos(tipo);

alter table costos enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='costos' and policyname='todo_costos') then
    create policy todo_costos on costos for all using (true) with check (true);
  end if;
end $$;
