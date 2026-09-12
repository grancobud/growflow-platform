-- Ambiente por carga manual.
--
-- Se aplico el 19/08/2026 directo sobre la base y el archivo quedo sin
-- versionar; esto lo reconstruye tal como esta en produccion. Es idempotente
-- para que correrlo de nuevo no rompa la base que ya lo tiene.
--
-- la asociación no tiene sensores: las lecturas las carga una persona con el
-- termohigrometro, dos veces por dia. El VPD NO se guarda, se calcula: un
-- derivado guardado se desincroniza del dato que lo origino apenas alguien
-- corrige la temperatura.

create table if not exists public.ambiente_salas (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  -- La etapa vive en la SALA, no en la lectura: es lo que hace que el semaforo
  -- compare contra el rango correcto (el VPD ideal en vegetativo no es el de floracion).
  etapa     text not null default 'vegetativo' check (etapa in ('vegetativo','floracion')),
  activa    boolean not null default true,
  orden     integer not null default 0,
  creado_en timestamptz not null default now()
);

create table if not exists public.ambiente_lecturas (
  id          uuid primary key default gen_random_uuid(),
  sala_id     uuid not null references public.ambiente_salas(id) on delete cascade,
  medido_en   timestamptz not null default now(),
  temp_c      numeric not null check (temp_c >= -10 and temp_c <= 60),
  humedad_pct numeric not null check (humedad_pct >= 0 and humedad_pct <= 100),
  nota        text,
  creado_en   timestamptz not null default now()
);

create index if not exists ambiente_lecturas_sala_fecha
  on public.ambiente_lecturas (sala_id, medido_en desc);

alter table public.ambiente_salas    enable row level security;
alter table public.ambiente_lecturas enable row level security;

-- Patron de `riegos`: ve todo rol real, escribe administrador y cultivador.
drop policy if exists ambiente_salas_ver on public.ambiente_salas;
create policy ambiente_salas_ver on public.ambiente_salas
  for select using (mi_rol() <> all (array['sin_perfil','demo']));

drop policy if exists ambiente_salas_escribir on public.ambiente_salas;
create policy ambiente_salas_escribir on public.ambiente_salas
  for all
  using      (mi_rol() = any (array['administrador','cultivador']))
  with check (mi_rol() = any (array['administrador','cultivador']));

drop policy if exists ambiente_lecturas_ver on public.ambiente_lecturas;
create policy ambiente_lecturas_ver on public.ambiente_lecturas
  for select using (mi_rol() <> all (array['sin_perfil','demo']));

drop policy if exists ambiente_lecturas_escribir on public.ambiente_lecturas;
create policy ambiente_lecturas_escribir on public.ambiente_lecturas
  for all
  using      (mi_rol() = any (array['administrador','cultivador']))
  with check (mi_rol() = any (array['administrador','cultivador']));
