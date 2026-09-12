-- Econometria › Instalaciones e Insumos (capex del grow).
-- Catalogo de equipos/insumos de instalacion agrupados por sistema (Riego, CO2,
-- Automatizacion, etc.), con proveedores reusables y presupuestos versionados.
-- Separado de la tabla `insumos` (stock operativo/consumibles) a proposito.

-- Proveedores reusables (mismo espiritu que proveedores de fertilizantes).
create table if not exists proveedores_instalacion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  nombre text not null,
  contacto text,                 -- tel / email / whatsapp
  url text,                      -- web / catalogo / ML
  zona text,                     -- ciudad / provincia
  notas text,
  creado_en timestamptz not null default now()
);

-- Catalogo de items de instalacion (biblioteca reusable, precio unitario).
create table if not exists instalaciones_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  nombre text not null,
  sistema text not null default 'Otro',   -- ver SISTEMAS en lib/instalaciones.ts
  marca text,
  modelo text,
  proveedor_id uuid references proveedores_instalacion(id) on delete set null,
  precio numeric,                -- precio unitario ARS
  unidad text default 'u',
  specs text,                    -- specs tecnicas libres
  url text,                      -- link al producto
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_instalaciones_items_sistema on instalaciones_items(sistema);
create index if not exists idx_instalaciones_items_proveedor on instalaciones_items(proveedor_id);

-- Presupuestos versionados (cotizaciones nombradas).
create table if not exists presupuestos_instalacion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  nombre text not null,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Lineas del presupuesto. Snapshot de nombre/sistema/proveedor/precio para que
-- el presupuesto guardado no cambie si despues editas o borras el item del catalogo.
create table if not exists presupuesto_instalacion_items (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references presupuestos_instalacion(id) on delete cascade,
  item_id uuid references instalaciones_items(id) on delete set null,
  nombre text not null,
  sistema text not null default 'Otro',
  proveedor text,                -- snapshot del nombre del proveedor
  precio_unit numeric not null default 0,
  cantidad numeric not null default 1,
  notas text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_presup_inst_items_presup on presupuesto_instalacion_items(presupuesto_id);

-- RLS: mismo patron permisivo que el resto del esquema (deuda conocida, ver skill).
alter table proveedores_instalacion enable row level security;
alter table instalaciones_items enable row level security;
alter table presupuestos_instalacion enable row level security;
alter table presupuesto_instalacion_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='proveedores_instalacion' and policyname='auth_proveedores_instalacion') then
    create policy auth_proveedores_instalacion on proveedores_instalacion for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='instalaciones_items' and policyname='auth_instalaciones_items') then
    create policy auth_instalaciones_items on instalaciones_items for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='presupuestos_instalacion' and policyname='auth_presupuestos_instalacion') then
    create policy auth_presupuestos_instalacion on presupuestos_instalacion for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='presupuesto_instalacion_items' and policyname='auth_presupuesto_instalacion_items') then
    create policy auth_presupuesto_instalacion_items on presupuesto_instalacion_items for all to authenticated using (true) with check (true);
  end if;
end $$;
