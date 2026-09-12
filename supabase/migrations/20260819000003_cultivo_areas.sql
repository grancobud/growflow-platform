-- Areas de cultivo: carpas, camas, sectores.
--
-- Antes esto era una constante en app/src/pages/PaginaSala.tsx con la
-- disposicion fisica de la instalacion de origen. Al forkear, la asociación veia cinco
-- carpas que nunca habia creado, todas en 0/0. Ahora las crea cada instalacion
-- desde la pantalla.
--
-- El `slot` de una planta sigue siendo `<area.id>-<indice>`: el prefijo dice en
-- que area esta. No se cambio el formato para no romper plantas ya ubicadas.

create table if not exists public.cultivo_areas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  tipo       text not null default 'carpa'
             check (tipo in ('carpa','cama','sector','sala','mesa','invernadero')),
  -- Medidas del espacio real, en metros. Son informativas: lo que dibuja la
  -- grilla es cols x rows. Se guardan para que el cartel diga "1.2 x 1.2 m".
  ancho_m    numeric(6,2) check (ancho_m is null or ancho_m > 0),
  largo_m    numeric(6,2) check (largo_m is null or largo_m > 0),
  -- La grilla. La capacidad es cols * rows: no se guarda aparte para que no se
  -- desincronice del dibujo (mismo criterio que el VPD en ambiente).
  cols       int not null check (cols between 1 and 40),
  rows       int not null check (rows between 1 and 40),
  orden      int not null default 0,
  activa     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create index if not exists cultivo_areas_orden_idx on public.cultivo_areas (orden, nombre);

alter table public.cultivo_areas enable row level security;

-- Patron de `riegos`: ve todo rol real, escribe administrador y cultivador.
drop policy if exists cultivo_areas_ver on public.cultivo_areas;
create policy cultivo_areas_ver on public.cultivo_areas
  for select using (mi_rol() <> all (array['sin_perfil','demo']));

drop policy if exists cultivo_areas_escribir on public.cultivo_areas;
create policy cultivo_areas_escribir on public.cultivo_areas
  for all
  using      (mi_rol() = any (array['administrador','cultivador']))
  with check (mi_rol() = any (array['administrador','cultivador']));
