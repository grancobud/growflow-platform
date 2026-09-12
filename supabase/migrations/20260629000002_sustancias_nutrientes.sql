-- Sustancias/sales personalizadas de la Calculadora creadora de fertilizantes.
-- Permite al usuario cargar sus propias sales con composición elemental.

create table if not exists sustancias_nutrientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  nombre text not null,
  formula text,
  comp jsonb not null default '{}'::jsonb,  -- fracción elemental por elemento
  bidon text not null default 'B' check (bidon in ('A','B','C')),
  liquido boolean not null default false,
  densidad numeric,                          -- g/mL si líquido
  costo_kg numeric,                          -- ARS por kg (o por L si líquido)
  creado_en timestamptz not null default now()
);

create index if not exists idx_sustancias_nutrientes_creado on sustancias_nutrientes(creado_en desc);

alter table sustancias_nutrientes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='sustancias_nutrientes' and policyname='auth_sustancias_nutrientes') then
    create policy auth_sustancias_nutrientes on sustancias_nutrientes
      for all to authenticated using (true) with check (true);
  end if;
end $$;
