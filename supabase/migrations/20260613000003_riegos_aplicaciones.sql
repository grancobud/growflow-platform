-- Registro detallado de riegos y de aplicaciones (fumigaciones/insecticidas/etc)
create table if not exists riegos (
  id uuid primary key default gen_random_uuid(),
  planta_id uuid references plantas(id) on delete cascade,
  fecha date not null default current_date,
  volumen_ml numeric,
  ppm numeric,
  ph numeric(3,1),
  escurrio boolean not null default false,
  escurrido_ml numeric,
  notas text,
  creado_en timestamptz not null default now()
);

create table if not exists aplicaciones (
  id uuid primary key default gen_random_uuid(),
  planta_id uuid references plantas(id) on delete cascade,
  fecha date not null default current_date,
  categoria text not null default 'Fumigacion'
    check (categoria in ('Fumigacion','Insecticida','Fungicida','Foliar','Acaricida','Bactericida','Otro')),
  producto text,
  dosis text,
  metodo text,
  notas text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_riegos_planta on riegos(planta_id);
create index if not exists idx_riegos_fecha on riegos(fecha desc);
create index if not exists idx_aplic_planta on aplicaciones(planta_id);
create index if not exists idx_aplic_fecha on aplicaciones(fecha desc);

alter table riegos enable row level security;
alter table aplicaciones enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='riegos' and policyname='auth_riegos') then
    create policy auth_riegos on riegos for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='aplicaciones' and policyname='auth_aplic') then
    create policy auth_aplic on aplicaciones for all to authenticated using (true) with check (true);
  end if;
end $$;
