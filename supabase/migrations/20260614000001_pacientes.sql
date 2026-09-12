-- Registro de pacientes REPROCANN vinculados a la asociacion civil.
-- Fichero con datos administrativos, medicos (opcionales) y PDF de credencial.

create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  -- identidad
  nombre_completo text not null,
  dni text,
  fecha_nacimiento date,
  telefono text,
  email text,
  localidad text,
  provincia text,
  domicilio text,
  foto_url text,
  -- reprocann
  reprocann_nro text,
  reprocann_estado text not null default 'En tramite'
    check (reprocann_estado in ('Vigente','En tramite','Vencido','Rechazado')),
  reprocann_emision date,
  reprocann_vencimiento date,
  modalidad text
    check (modalidad in ('Cultivo propio','Cultivo solidario','Tercero/ONG')),
  credencial_url text, -- PDF de la credencial
  -- medico (opcional, dato sensible)
  patologia text,
  medico_tratante text,
  matricula_medico text,
  -- asociacion
  socio boolean not null default true,
  fecha_alta date default current_date,
  activo boolean not null default true,
  notas text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_pacientes_estado on pacientes(reprocann_estado);
create index if not exists idx_pacientes_venc on pacientes(reprocann_vencimiento);

-- App personal local: RLS abierto (igual que el resto del esquema personal).
alter table pacientes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='pacientes' and policyname='todo_pacientes') then
    create policy todo_pacientes on pacientes for all using (true) with check (true);
  end if;
end $$;

-- Bucket de documentos (PDF de credenciales). Publico para lectura.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='docs_auth_all') then
    create policy docs_auth_all on storage.objects for all to authenticated
      using (bucket_id = 'documentos') with check (bucket_id = 'documentos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='docs_public_read') then
    create policy docs_public_read on storage.objects for select to anon
      using (bucket_id = 'documentos');
  end if;
end $$;
