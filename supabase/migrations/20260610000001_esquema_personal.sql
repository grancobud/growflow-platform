-- CannTrace Personal - esquema simplificado para cultivo personal
-- Sin codigos jerarquicos, sin audit trail regulatorio, sin lotes.

create table geneticas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  banco text,
  tipo text not null default 'Desconocido'
    check (tipo in ('Feminizada','Automatica','Regular','Esqueje','Desconocido')),
  thc_estimado numeric(4,1),
  cbd_estimado numeric(4,1),
  tiempo_flora_dias int,
  notas text,
  creado_en timestamptz not null default now()
);

create table plantas (
  id uuid primary key default gen_random_uuid(),
  genetica_id uuid references geneticas(id) on delete set null,
  madre_id uuid references plantas(id) on delete set null, -- para esquejes
  apodo text,
  fecha_germinacion date,
  fase text not null default 'Germinacion'
    check (fase in ('Germinacion','Plantula','Vegetativo','Floracion','Secado','Curado','Cosechada','Muerta')),
  sustrato text,
  maceta text,
  ubicacion text,
  activa boolean not null default true,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table eventos (
  id uuid primary key default gen_random_uuid(),
  planta_id uuid references plantas(id) on delete cascade,
  tipo text not null default 'Nota'
    check (tipo in ('Riego','Fertilizacion','Poda','Trasplante','CambioFase','Entrenamiento','Problema','Foto','Nota')),
  fecha date not null default current_date,
  detalle text,
  foto_url text,
  mensaje_original text, -- texto crudo que llego por Telegram
  creado_en timestamptz not null default now()
);

create table cosechas (
  id uuid primary key default gen_random_uuid(),
  planta_id uuid references plantas(id) on delete cascade,
  fecha date not null default current_date,
  peso_humedo_g numeric(7,1),
  peso_seco_g numeric(7,1),
  notas_curado text,
  notas_sabor text,
  valoracion int check (valoracion between 1 and 10),
  creado_en timestamptz not null default now()
);

create index idx_plantas_genetica on plantas(genetica_id);
create index idx_eventos_planta on eventos(planta_id);
create index idx_eventos_fecha on eventos(fecha desc);
create index idx_cosechas_planta on cosechas(planta_id);

-- actualizado_en automatico en plantas
create or replace function set_actualizado_en() returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

create trigger trg_plantas_actualizado before update on plantas
  for each row execute function set_actualizado_en();

-- al registrar evento CambioFase con detalle = fase nueva, actualizar la planta
create or replace function aplicar_cambio_fase() returns trigger language plpgsql as $$
begin
  if new.tipo = 'CambioFase' and new.planta_id is not null and new.detalle is not null then
    update plantas set fase = new.detalle
    where id = new.planta_id
      and new.detalle in ('Germinacion','Plantula','Vegetativo','Floracion','Secado','Curado','Cosechada','Muerta');
  end if;
  return new;
end $$;

create trigger trg_eventos_cambio_fase after insert on eventos
  for each row execute function aplicar_cambio_fase();

-- vista para el panel
create view resumen_plantas as
select
  p.id,
  coalesce(p.apodo, g.nombre, 'Sin nombre') as nombre,
  g.nombre as genetica,
  g.banco,
  g.tipo,
  p.fase,
  p.fecha_germinacion,
  (current_date - p.fecha_germinacion) as dias_de_vida,
  p.sustrato,
  p.maceta,
  p.ubicacion,
  p.activa,
  (select max(e.fecha) from eventos e where e.planta_id = p.id and e.tipo = 'Riego') as ultimo_riego,
  (select count(*) from eventos e where e.planta_id = p.id) as total_eventos
from plantas p
left join geneticas g on g.id = p.genetica_id;

-- App personal local de un solo usuario: RLS abierto para anon y authenticated.
alter table geneticas enable row level security;
alter table plantas enable row level security;
alter table eventos enable row level security;
alter table cosechas enable row level security;

create policy todo_geneticas on geneticas for all using (true) with check (true);
create policy todo_plantas on plantas for all using (true) with check (true);
create policy todo_eventos on eventos for all using (true) with check (true);
create policy todo_cosechas on cosechas for all using (true) with check (true);
