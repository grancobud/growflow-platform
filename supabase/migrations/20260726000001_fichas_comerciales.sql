-- Fichas técnicas de fertilizantes comerciales.
--
-- La idea: guardar el PDF/etiqueta de cada producto que Gastón tiene, junto con
-- la composición que declara y las sales de las que sale, para poder clonarlo
-- igual y saber de dónde viene cada elemento. Es el respaldo documental de lo
-- que hoy vive hardcodeado en SALES_DEFECTO (los ryano_*, athena_*, etc).

create table if not exists public.fichas_comerciales (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,
  marca        text not null,
  producto     text not null,
  linea        text,                       -- "ABC coco", "Pro Line", etc
  forma        text default 'liquido' check (forma in ('liquido', 'polvo')),
  densidad     numeric,                    -- g/mL, sólo líquidos
  npk          text,                       -- lo que dice el frente del envase
  dosis_ml_l   numeric,                    -- dosis de referencia de la etiqueta
  composicion  jsonb default '{}'::jsonb,  -- { NO3: 3.2, P: 1.1, ... } en % p/p
  sales_origen text[] default '{}',        -- sales declaradas o deducidas
  sal_id       text,                       -- id en SALES_DEFECTO si ya está clonado
  verificado   boolean default false,      -- ¿cierra la estequiometría?
  nota         text,                       -- hallazgos del análisis
  pdf_path     text,                       -- ruta en el bucket `fichas`
  pdf_nombre   text,
  pdf_tam      integer,                    -- bytes, para mostrar el peso
  creado_en    timestamptz default now()
);

create index if not exists fichas_comerciales_user_idx  on public.fichas_comerciales (user_id);
create index if not exists fichas_comerciales_marca_idx on public.fichas_comerciales (marca);

alter table public.fichas_comerciales enable row level security;

-- Mismo criterio que el resto de las tablas del creador de nutrientes.
-- OJO con el `to authenticated`: sin eso la política queda sobre el rol `public`,
-- que incluye a `anon`, y las fichas se leen sin iniciar sesión.
drop policy if exists fichas_comerciales_todo on public.fichas_comerciales;
create policy fichas_comerciales_todo on public.fichas_comerciales
  for all to authenticated using (true) with check (true);

-- Bucket privado: son fichas compradas, no van a estar accesibles por URL suelta
-- como pasó con `documentos`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fichas', 'fichas', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fichas_lectura   on storage.objects;
drop policy if exists fichas_escritura on storage.objects;
drop policy if exists fichas_borrado   on storage.objects;

-- Idem acá: sin el `to authenticated` un anónimo puede pedir una URL firmada de
-- cualquier PDF del bucket, aunque el bucket sea privado.
create policy fichas_lectura on storage.objects
  for select to authenticated using (bucket_id = 'fichas');
create policy fichas_escritura on storage.objects
  for insert to authenticated with check (bucket_id = 'fichas');
create policy fichas_borrado on storage.objects
  for delete to authenticated using (bucket_id = 'fichas');
