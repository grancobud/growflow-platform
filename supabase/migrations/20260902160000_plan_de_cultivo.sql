-- EL PLAN DE CULTIVO: LO QUE SE DECLARA, CONTRA LO QUE HAY.
--
-- Lo pidio Socio el 02/09/2026: «deberia alimentarse de un plan de cultivo,
-- el que se declara en el REPROCANN, diciendo cuanta gente, que genetica,
-- cuantas plantas, toda esa vaina», y «no le hace falta que este cargando
-- planta por planta».
--
-- PERO NO ES SOLO COMODIDAD DE CARGA, y esa es la parte que hace que valga la
-- pena tener una tabla: el plan es el DOCUMENTO QUE SE DECLARA. Con el cargado,
-- el sistema puede decir «declaraste 60 y hay 63 en la sala», que hoy es
-- imposible — no hay contra que comparar, solo plantas sueltas.
--
-- ⚠️ EL PLAN NO GENERA LAS PLANTAS, LAS CONTRASTA. Generarlas y listo suena
-- comodo y a los dos meses el plan es ficcion: murieron tres, se repusieron
-- dos, y nadie vuelve a mirarlo. El plan es la declaracion, las plantas son la
-- realidad, y Coherencia cruza las dos. Un plan que se edita para que cierre
-- deja de ser una declaracion.
create table if not exists public.planes_cultivo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  desde date,
  hasta date,

  -- LO QUE SE DECLARA. Los numeros son los que se cruzan; el resto es texto
  -- libre a proposito: es lo que va en el documento y cada organismo lo pide
  -- redactado distinto. Encasillarlo en catalogos obligaria a mantener una
  -- taxonomia que cambia con cada resolucion.
  plantas_previstas integer,
  pacientes_previstos integer,
  geneticas text,
  espacios text,
  riego text,
  fertilizacion text,
  luces text,
  notas text,

  activo boolean not null default true,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists planes_cultivo_activo_idx on public.planes_cultivo (activo, desde desc);
alter table public.planes_cultivo enable row level security;

create policy planes_ver on public.planes_cultivo
  for select to authenticated using (mi_rol() is not null);
create policy planes_escribir on public.planes_cultivo
  for all to authenticated
  using (mi_rol() in ('administrador','administrador_sistema','director_cultivo'))
  with check (mi_rol() in ('administrador','administrador_sistema','director_cultivo'));

revoke all on public.planes_cultivo from anon;

comment on table public.planes_cultivo is
  'El plan que se declara en REPROCANN. NO genera las plantas: se contrasta '
  'con ellas. Un plan que se edita para que cierre deja de ser una declaracion.';
