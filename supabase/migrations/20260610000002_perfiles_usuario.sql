-- Perfil de usuario que el frontend espera (login). Un solo usuario admin local.
create table perfiles_usuario (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol text not null default 'administrador'
    check (rol in ('operador','supervisor','auditor','administrador')),
  activo boolean not null default true,
  ultimo_acceso timestamptz
);

alter table perfiles_usuario enable row level security;
create policy todo_perfiles on perfiles_usuario for all using (true) with check (true);

-- Perfil inicial para el primer usuario que exista. Sin nombre propio: cada
-- instalacion completa el suyo desde la app.
insert into perfiles_usuario (id, nombre_completo, rol)
select id, 'Administrador', 'administrador' from auth.users order by created_at limit 1;
