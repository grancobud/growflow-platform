-- Insumos faltantes: lista de compras de sales/insumos que hay que reponer.
-- Carga tipo Proveedores (dropdown de sal del catálogo) + cantidad, prioridad, nota.

create table if not exists insumos_faltantes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  sal_id text,                 -- id de la sal del catálogo (null si insumo libre)
  nombre text not null,        -- nombre del insumo (snapshot o libre)
  cantidad numeric,            -- cuánto falta
  unidad text,                 -- kg | g | L | mL | u
  prioridad text not null default 'media' check (prioridad in ('alta','media','baja')),
  nota text,
  comprado boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists idx_insumos_faltantes_creado on insumos_faltantes(creado_en desc);

alter table insumos_faltantes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='insumos_faltantes' and policyname='auth_insumos_faltantes') then
    create policy auth_insumos_faltantes on insumos_faltantes
      for all to authenticated using (true) with check (true);
  end if;
end $$;
