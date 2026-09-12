-- Perfiles guardados de la Calculadora creadora de fertilizantes.
-- Guarda el objetivo en ppm, el agua de partida y las sales activas, como JSON.

create table if not exists perfiles_nutrientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  nombre text not null,
  perfil jsonb not null default '{}'::jsonb,   -- objetivo ppm por elemento
  agua jsonb not null default '{}'::jsonb,      -- ppm que aporta el agua
  sales jsonb not null default '[]'::jsonb,     -- ids de sales activas
  creado_en timestamptz not null default now()
);

create index if not exists idx_perfiles_nutrientes_creado on perfiles_nutrientes(creado_en desc);

alter table perfiles_nutrientes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='perfiles_nutrientes' and policyname='auth_perfiles_nutrientes') then
    create policy auth_perfiles_nutrientes on perfiles_nutrientes
      for all to authenticated using (true) with check (true);
  end if;
end $$;
