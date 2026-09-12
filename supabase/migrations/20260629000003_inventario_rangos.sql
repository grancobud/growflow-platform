-- Inventario de sustancias (costo/kg + stock + nota) editable por ficha,
-- y rangos min/max en los perfiles guardados.

create table if not exists inventario_nutrientes (
  sal_id text primary key,          -- id de la sal (default o uuid de custom)
  user_id uuid,
  costo_kg numeric,
  stock numeric,
  unidad text,
  nota text,
  actualizado_en timestamptz not null default now()
);

alter table inventario_nutrientes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='inventario_nutrientes' and policyname='auth_inventario_nutrientes') then
    create policy auth_inventario_nutrientes on inventario_nutrientes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- rangos min/max por elemento en los perfiles guardados
alter table perfiles_nutrientes add column if not exists rangos jsonb not null default '{}'::jsonb;
