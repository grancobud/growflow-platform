-- Ofertas de proveedor por item de instalacion (mismo patron que proveedores_nutrientes).
-- Cada item puede tener N ofertas (proveedor + precio + foto de la captura); una se
-- marca `elegido` = precio de referencia, que se copia a instalaciones_items.precio.

create table if not exists ofertas_instalacion (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references instalaciones_items(id) on delete cascade,
  proveedor_id uuid references proveedores_instalacion(id) on delete set null,
  precio numeric,
  presentacion text,          -- "caja x10", "bolsa 25kg", "hora", etc.
  imagen text,                -- data URL base64 o URL (captura del precio, ej. ML)
  nota text,
  elegido boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists idx_ofertas_instalacion_item on ofertas_instalacion(item_id);

alter table ofertas_instalacion enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='ofertas_instalacion' and policyname='auth_ofertas_instalacion') then
    create policy auth_ofertas_instalacion on ofertas_instalacion for all to authenticated using (true) with check (true);
  end if;
end $$;
