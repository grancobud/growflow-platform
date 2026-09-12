-- Asistencia de los growers (equipo de cultivo) + bitacora de actividades del dia.

-- Roster del equipo de cultivo.
create table if not exists cultivadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rol text not null default 'Cultivador'
    check (rol in ('Cultivador','Responsable','Encargado','Voluntario')),
  telefono text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Una jornada = un dia de actividad.
create table if not exists jornadas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  responsable text,
  clima text,
  resumen text,
  notas text,
  creado_en timestamptz not null default now()
);

-- Asistencia de cada grower en una jornada.
create table if not exists asistencias (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid references jornadas(id) on delete cascade,
  cultivador_id uuid references cultivadores(id) on delete cascade,
  presente boolean not null default true,
  hora_entrada text,
  hora_salida text,
  notas text,
  creado_en timestamptz not null default now()
);

-- Bitacora: actividades realizadas en la jornada.
create table if not exists actividades (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid references jornadas(id) on delete cascade,
  hora text,
  tipo text not null default 'Otro'
    check (tipo in ('Riego','Fumigacion','Poda','Trasplante','Cosecha','Mantenimiento','Limpieza','Reunion','Otro')),
  descripcion text,
  cultivador_id uuid references cultivadores(id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists idx_jornadas_fecha on jornadas(fecha desc);
create index if not exists idx_asistencias_jornada on asistencias(jornada_id);
create index if not exists idx_actividades_jornada on actividades(jornada_id);

alter table cultivadores enable row level security;
alter table jornadas enable row level security;
alter table asistencias enable row level security;
alter table actividades enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='cultivadores' and policyname='todo_cultivadores') then
    create policy todo_cultivadores on cultivadores for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='jornadas' and policyname='todo_jornadas') then
    create policy todo_jornadas on jornadas for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='asistencias' and policyname='todo_asistencias') then
    create policy todo_asistencias on asistencias for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='actividades' and policyname='todo_actividades') then
    create policy todo_actividades on actividades for all using (true) with check (true);
  end if;
end $$;
