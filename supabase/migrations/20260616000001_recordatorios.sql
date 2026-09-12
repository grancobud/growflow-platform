-- Recordatorios/agenda del calendario: eventos propios con repeticion (riego,
-- fertilizacion, tareas...). El calendario tambien agrega los eventos que ya
-- existen (riegos, aplicaciones, cosechas, mantenimientos, eventos de planta).

create table if not exists recordatorios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'Recordatorio'
    check (tipo in ('Riego','Fertilizacion','Poda','Trasplante','Fumigacion','Cosecha','Mantenimiento','Recordatorio','Otro')),
  fecha date not null default current_date,
  hora time,
  repeticion text not null default 'ninguna'
    check (repeticion in ('ninguna','diaria','cada_n_dias','semanal','mensual')),
  intervalo integer,            -- para cada_n_dias (ej: cada 2 dias)
  hasta date,                   -- fin opcional de la repeticion
  planta_id uuid references plantas(id) on delete set null,
  notas text,
  hecho boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists idx_recordatorios_fecha on recordatorios(fecha);

alter table recordatorios enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='recordatorios' and policyname='todo_recordatorios') then
    create policy todo_recordatorios on recordatorios for all using (true) with check (true);
  end if;
end $$;
