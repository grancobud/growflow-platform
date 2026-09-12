-- Stock & Insumos: inventario del cultivo (equipos, fertilizantes, herramientas,
-- CO2, etc.) + bitacora de mantenimiento con recordatorio del proximo.

-- Inventario de insumos y equipos del cultivo.
create table if not exists insumos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Otro'
    check (categoria in (
      'Fertilizante','Iluminacion','Climatizacion','Riego','CO2',
      'Sustrato','Sanidad','Medicion','Herramienta','Otro')),
  marca text,
  modelo text,
  cantidad numeric not null default 0,
  unidad text default 'u',
  potencia_w numeric,
  specs text,
  dosis text,
  uso text,
  stock_minimo numeric default 0,
  proveedor text,
  precio numeric,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Bitacora de mantenimiento (limpiezas, recargas de CO2, cambios de filtro...).
-- Puede vincularse a un insumo/equipo o referirse a algo por nombre libre.
create table if not exists mantenimientos (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid references insumos(id) on delete set null,
  equipo text,
  tipo text not null default 'Limpieza'
    check (tipo in (
      'Limpieza','Recarga','Cambio de filtro','Calibracion','Revision',
      'Reemplazo','Lubricacion','Desinfeccion','Otro')),
  fecha_realizado date not null default current_date,
  frecuencia_dias integer,
  proximo date,
  responsable text,
  notas text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_insumos_categoria on insumos(categoria);
create index if not exists idx_mantenimientos_insumo on mantenimientos(insumo_id);
create index if not exists idx_mantenimientos_proximo on mantenimientos(proximo);

alter table insumos enable row level security;
alter table mantenimientos enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='insumos' and policyname='todo_insumos') then
    create policy todo_insumos on insumos for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='mantenimientos' and policyname='todo_mantenimientos') then
    create policy todo_mantenimientos on mantenimientos for all using (true) with check (true);
  end if;
end $$;
