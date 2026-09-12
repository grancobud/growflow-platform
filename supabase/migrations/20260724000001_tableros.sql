-- Tablero eléctrico: documentación de tableros del cultivo.
-- tableros = cabecera (nombre, ubicación, tensión, acometida).
-- tableros_circuitos = cada carga/línea: qué protege, qué contactor, sección de cable.

create table if not exists tableros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  nombre text not null,                    -- ej "Tablero cultivo Sala 1"
  ubicacion text,                          -- sala / lugar físico
  tension text not null default 'mono' check (tension in ('mono','tri')),
  acometida_a numeric,                     -- corriente contratada / disyuntor general (A)
  proteccion_general text,                 -- ej "Termomagnética 2x63A + Diferencial 4x63A 30mA"
  notas text,
  creado_en timestamptz not null default now()
);

create table if not exists tableros_circuitos (
  id uuid primary key default gen_random_uuid(),
  tablero_id uuid not null references tableros(id) on delete cascade,
  orden integer not null default 0,        -- para ordenar en el unifilar
  nombre text not null,                    -- carga: "12 luces LED", "AC", "Bomba riego"
  tipo text not null default 'otro' check (tipo in ('luz','ac','deshumi','ventilacion','extraccion','bomba','co2','osmosis','otro')),
  potencia_w numeric,                      -- consumo en watts
  corriente_a numeric,                     -- corriente nominal (A); si null se estima de potencia_w
  proteccion text,                         -- ej "Termomagnética 2x16A"
  contactor text,                          -- ej "Chint NC1-0910 bobina 220V"
  seccion_cable_mm2 numeric,               -- sección del cable (mm²)
  sala text,                               -- sala que alimenta
  notas text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_tableros_circuitos_tablero on tableros_circuitos(tablero_id, orden);

alter table tableros enable row level security;
alter table tableros_circuitos enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='tableros' and policyname='auth_tableros') then
    create policy auth_tableros on tableros
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tableros_circuitos' and policyname='auth_tableros_circuitos') then
    create policy auth_tableros_circuitos on tableros_circuitos
      for all to authenticated using (true) with check (true);
  end if;
end $$;
