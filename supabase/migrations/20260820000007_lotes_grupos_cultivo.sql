-- B1 (lote y grupos de cultivo) y B2 (eventos de grupo).
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- B1 -- Hoy el grupo experimental vive en el PREFIJO DEL APODO. Las 60 plantas
-- del Proyecto Demo se llaman "PA-A #1".."PA-A #45" y "PA-B #1".."PA-B #15",
-- y esa cadena es lo unico que dice que son dos grupos con sustratos distintos
-- (A: coco+perlita 5 L, B: organico 7 L). Renombrar una planta rompe el dato.
--
-- Son dos conceptos, no uno:
--   * LOTE   -- la corrida: mismo dia de germinacion, misma genetica. Es lo que
--               se compara contra otra corrida.
--   * GRUPO  -- la division DENTRO de la corrida: lo que se hace distinto a
--               proposito para comparar. Es la unidad del experimento.
--
-- Se llaman `cultivo_lotes` / `cultivo_grupos` y no `lotes`: `ong_lotes` ya
-- existe y es otra cosa (la partida fraccionada para dispensar). Dos cosas
-- distintas con el mismo nombre en la misma base terminan mal.
--
-- B2 -- `eventos` y `riegos` cuelgan de `planta_id` y nada mas. Regar las 60
-- plantas son 60 filas de riego y 60 de evento: hay 600 riegos en apenas 10
-- fechas, y 600 de los 724 eventos son Riego. Ademas corregir un riego obliga a
-- corregir 60 filas.
--
-- Con `grupo_id` un riego al grupo es UNA fila. No se migra lo ya cargado:
-- reescribir un ano de registros para ahorrar filas es riesgo sin beneficio.
-- Las dos formas conviven y la linea de tiempo de una planta muestra las dos.

create table if not exists public.cultivo_lotes (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  fecha_germinacion date,
  genetica_id       uuid references public.geneticas(id) on delete set null,
  area_id           uuid references public.cultivo_areas(id) on delete set null,
  notas             text,
  activo            boolean not null default true,
  creado_en         timestamptz not null default now()
);

create table if not exists public.cultivo_grupos (
  id        uuid primary key default gen_random_uuid(),
  lote_id   uuid not null references public.cultivo_lotes(id) on delete cascade,
  nombre    text not null,
  -- Lo que se hace distinto en este grupo. Nullable: un lote sin experimento
  -- tiene un solo grupo y estos campos vacios.
  sustrato  text,
  maceta    text,
  -- La hipotesis en una linea. Es lo que despues explica por que se compararon.
  variable  text,
  notas     text,
  orden     int not null default 0,
  creado_en timestamptz not null default now()
);

create index if not exists cultivo_grupos_lote_idx on public.cultivo_grupos (lote_id, orden);

-- La planta apunta al GRUPO, no al lote: el lote sale del grupo. Un solo camino
-- para llegar al dato evita que planta y grupo digan lotes distintos.
alter table public.plantas
  add column if not exists grupo_id uuid references public.cultivo_grupos(id) on delete set null;
create index if not exists plantas_grupo_idx on public.plantas (grupo_id);

-- B2: un evento o un riego cuelgan de UNA de tres cosas: planta, grupo o lote.
--
-- El nivel LOTE hace falta y no es teorico: la base ya tiene cuatro eventos
-- huerfanos, sin planta, que la sesion anterior escribio con el nivel metido en
-- el texto porque no habia donde ponerlo —
--   "[Lote] Proyecto Demo - siembra. 60 plantas..."
--   "[Lote] Inoculacion inicial: micorrizas y trichodermas..."
--   "[Grupo A] Fase de consolidacion radicular..."
--   "[Grupo B] Mayor expansion foliar basal."
-- Al no colgar de ninguna planta no aparecen en ninguna linea de tiempo: estan
-- guardados y no se ven. El backfill de mas abajo los reubica.
alter table public.eventos
  add column if not exists grupo_id uuid references public.cultivo_grupos(id) on delete cascade,
  add column if not exists lote_id  uuid references public.cultivo_lotes(id)  on delete cascade;
alter table public.riegos
  add column if not exists grupo_id uuid references public.cultivo_grupos(id) on delete cascade,
  add column if not exists lote_id  uuid references public.cultivo_lotes(id)  on delete cascade;

create index if not exists eventos_grupo_idx on public.eventos (grupo_id, fecha);
create index if not exists eventos_lote_idx  on public.eventos (lote_id, fecha);
create index if not exists riegos_grupo_idx  on public.riegos  (grupo_id, fecha);
create index if not exists riegos_lote_idx   on public.riegos  (lote_id, fecha);

-- El backfill va ANTES del check: si no, los cuatro huerfanos lo violan y la
-- migracion entera se cae. (Paso: el primer intento fallo justo por esto.)

-- 1. El lote y sus dos grupos, sacados de los datos que ya estan.
insert into public.cultivo_lotes (nombre, fecha_germinacion, genetica_id, area_id, notas)
select 'Proyecto Demo',
       min(p.fecha_germinacion),
       (select genetica_id from public.plantas where genetica_id is not null limit 1),
       (select id from public.cultivo_areas order by orden limit 1),
       'Creado desde los prefijos de apodo PA-A / PA-B, que era donde vivia el grupo.'
  from public.plantas p
 where p.apodo like 'PA-%'
having count(*) > 0
   and not exists (select 1 from public.cultivo_lotes where nombre = 'Proyecto Demo');

insert into public.cultivo_grupos (lote_id, nombre, sustrato, maceta, variable, orden)
select l.id, g.nombre, g.sustrato, g.maceta, g.variable, g.orden
  from public.cultivo_lotes l
  cross join (values
    ('Grupo A', 'Coco + perlita', '5 L', 'Sustrato inerte con fertirriego', 0),
    ('Grupo B', 'Organico',       '7 L', 'Sustrato vivo, sin fertirriego',  1)
  ) as g(nombre, sustrato, maceta, variable, orden)
 where l.nombre = 'Proyecto Demo'
   and not exists (select 1 from public.cultivo_grupos where lote_id = l.id);

-- 2. Cada planta a su grupo, por el prefijo del apodo.
update public.plantas p
   set grupo_id = g.id
  from public.cultivo_grupos g
  join public.cultivo_lotes l on l.id = g.lote_id
 where l.nombre = 'Proyecto Demo'
   and p.grupo_id is null
   and ((p.apodo like 'PA-A%' and g.nombre = 'Grupo A')
     or (p.apodo like 'PA-B%' and g.nombre = 'Grupo B'));

-- 3. Los cuatro eventos huerfanos, a donde correspondan.
update public.eventos e
   set lote_id = l.id
  from public.cultivo_lotes l
 where l.nombre = 'Proyecto Demo'
   and e.planta_id is null and e.grupo_id is null and e.lote_id is null
   and e.detalle like '[Lote]%';

update public.eventos e
   set grupo_id = g.id
  from public.cultivo_grupos g
  join public.cultivo_lotes l on l.id = g.lote_id
 where l.nombre = 'Proyecto Demo'
   and e.planta_id is null and e.grupo_id is null and e.lote_id is null
   and e.detalle like '[' || g.nombre || ']%';

-- Y si quedara alguno sin reubicar, al lote: es preferible un evento en el
-- nivel equivocado a que el check tire abajo la migracion.
update public.eventos e
   set lote_id = (select id from public.cultivo_lotes where nombre = 'Proyecto Demo')
 where e.planta_id is null and e.grupo_id is null and e.lote_id is null
   and exists (select 1 from public.cultivo_lotes where nombre = 'Proyecto Demo');

-- 4. Recien ahora el check: exactamente UNO de los tres.
alter table public.eventos alter column planta_id drop not null;
alter table public.riegos  alter column planta_id drop not null;

alter table public.eventos drop constraint if exists eventos_planta_o_grupo;
alter table public.eventos add constraint eventos_planta_o_grupo
  check ((planta_id is not null)::int + (grupo_id is not null)::int + (lote_id is not null)::int = 1);

alter table public.riegos drop constraint if exists riegos_planta_o_grupo;
alter table public.riegos add constraint riegos_planta_o_grupo
  check ((planta_id is not null)::int + (grupo_id is not null)::int + (lote_id is not null)::int = 1);

alter table public.cultivo_lotes  enable row level security;
alter table public.cultivo_grupos enable row level security;

-- Patron de `riegos`: ve todo rol real, escribe administrador y cultivador.
drop policy if exists cultivo_lotes_ver on public.cultivo_lotes;
create policy cultivo_lotes_ver on public.cultivo_lotes
  for select using (mi_rol() <> all (array['sin_perfil','demo']));
drop policy if exists cultivo_lotes_escribir on public.cultivo_lotes;
create policy cultivo_lotes_escribir on public.cultivo_lotes
  for all
  using      (mi_rol() = any (array['administrador','cultivador']))
  with check (mi_rol() = any (array['administrador','cultivador']));

drop policy if exists cultivo_grupos_ver on public.cultivo_grupos;
create policy cultivo_grupos_ver on public.cultivo_grupos
  for select using (mi_rol() <> all (array['sin_perfil','demo']));
drop policy if exists cultivo_grupos_escribir on public.cultivo_grupos;
create policy cultivo_grupos_escribir on public.cultivo_grupos
  for all
  using      (mi_rol() = any (array['administrador','cultivador']))
  with check (mi_rol() = any (array['administrador','cultivador']));
