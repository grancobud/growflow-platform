-- El rol «Director de cultivo»: el responsable tecnico de la Res. 1780.
--
-- 31/08/2026. Es el `cultivador` MAS lo que hay que firmar por el cultivo:
-- traslados, declaraciones juradas y predios. Responde por el material que SALE
-- del predio, asi que la carta de porte es suya.
--
-- LOS CINCO LUGARES DONDE VIVE UN ROL (§3.3 del handoff). Este archivo cubre el
-- quinto; los otros cuatro son codigo:
--   1. `RolUsuario`                        app/src/types/index.ts
--   2. `PERMISOS_ROL`, `RUTA_DEFAULT_ROL`  app/src/hooks/useAuth.ts
--   3. `ROLES_ASIGNABLES`                  app/src/lib/usuarios.ts
--   4. `ROLES`                             supabase/functions/usuarios-invitar/
--   5. el CHECK de abajo, y las policies que nombran roles
--
-- ⚠ AL HACER EL 4 APARECIO QUE `administrador_sistema` NUNCA HABIA ENTRADO AHI.
-- El rol se creo el 30/08, la pantalla lo ofrecia, y la Edge Function lo habria
-- rechazado al invitar. Nadie lo habia probado porque no se invito a nadie con
-- ese rol. Es el error que el handoff ya documentaba en §7.3, en el cuarto
-- lugar en vez del quinto: la lista de roles se olvida SIEMPRE en el sitio que
-- no se ejercita.

alter table public.perfiles_usuario drop constraint if exists perfiles_usuario_rol_check;
alter table public.perfiles_usuario add constraint perfiles_usuario_rol_check
  check (rol = any (array[
    'administrador','administrador_sistema','administrativo','cultivador',
    'director_medico','director_cultivo','auditor','demo',
    'operador','supervisor']));

-- Donde escribe el cultivador, escribe el director de cultivo.
--
-- Se recorren las policies REALES en vez de escribir la lista a mano: son 21 y
-- una que se olvide deja un rol que entra y no puede guardar nada — el sintoma
-- exacto de §7.4, un permiso de pantalla sin respaldo en la base.
do $$
declare r record; nueva_qual text; nueva_check text;
begin
  for r in
    select tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (qual like '%''cultivador''%' or with_check like '%''cultivador''%')
       and coalesce(qual, '') not like '%director_cultivo%'
  loop
    nueva_qual  := replace(r.qual,       '''cultivador''::text', '''cultivador''::text, ''director_cultivo''::text');
    nueva_check := replace(r.with_check, '''cultivador''::text', '''cultivador''::text, ''director_cultivo''::text');
    if r.with_check is null then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, nueva_qual);
    elsif r.qual is null then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, nueva_check);
    else
      execute format('alter policy %I on public.%I using (%s) with check (%s)',
                     r.policyname, r.tablename, nueva_qual, nueva_check);
    end if;
  end loop;
end $$;

-- Lo propio del rol.
alter policy ong_traslados_ver on public.ong_traslados
  using (mi_rol() = any (array['administrador','administrador_sistema','director_medico',
                              'administrativo','auditor','director_cultivo']));
alter policy ong_traslados_escribir on public.ong_traslados
  using (mi_rol() = any (array['administrador','administrador_sistema','director_medico',
                              'administrativo','director_cultivo']))
  with check (mi_rol() = any (array['administrador','administrador_sistema','director_medico',
                                   'administrativo','director_cultivo']));

alter policy ong_ddjj_escribir on public.ong_ddjj
  using (mi_rol() = any (array['administrador','administrador_sistema','administrativo','director_cultivo']))
  with check (mi_rol() = any (array['administrador','administrador_sistema','administrativo','director_cultivo']));

alter policy ong_predios_escribir on public.ong_predios
  using (mi_rol() = any (array['administrador','administrador_sistema','administrativo','director_cultivo']))
  with check (mi_rol() = any (array['administrador','administrador_sistema','administrativo','director_cultivo']));

-- LAS SEIS INSTITUCIONALES DEJAN DE VERSE DESDE LA CUENTA DEMO.
--
-- Mismo caso que `ong_entidad` esa misma manana: el filtro era `<> 'sin_perfil'`
-- a secas, que NO excluye a la demo. Hoy estan casi vacias —0 actas, 0 libros,
-- 0 predios, 0 autoridades, 3 ddjj— y por eso es el momento: el dia que se
-- carguen las actas y los libros rubricados quedan filtradas solas.
alter policy ong_actas_ver       on public.ong_actas       using (mi_rol() <> all (array['sin_perfil','demo']));
alter policy ong_autoridades_ver on public.ong_autoridades using (mi_rol() <> all (array['sin_perfil','demo']));
alter policy ong_ddjj_ver        on public.ong_ddjj        using (mi_rol() <> all (array['sin_perfil','demo']));
alter policy ong_libros_ver      on public.ong_libros      using (mi_rol() <> all (array['sin_perfil','demo']));
alter policy ong_predios_ver     on public.ong_predios     using (mi_rol() <> all (array['sin_perfil','demo']));
alter policy ong_requisitos_ver  on public.ong_requisitos  using (mi_rol() <> all (array['sin_perfil','demo']));

-- El cupo, sin exponer una sola ficha.
--
-- `calcularCapacidad` recibe un CONTEO, no el padron, asi que alcanza con los
-- agregados. Sin esto el director de cultivo veria «N plantas en floracion de
-- 0», porque el tope sale de multiplicar la cantidad de pacientes: un cero ahi
-- no se lee como «no se», se lee como un tope real y MAS CHICO que el
-- verdadero, que es la peor forma de equivocar un limite normativo.
--
-- La usan TODOS los roles y no solo el que la necesita: un solo camino al dato.
-- Si el numero saliera del padron para unos y de aca para otros, dos pantallas
-- podrian mostrar cupos distintos sobre los mismos datos.
create or replace view public.cupo_conteos as
select
  (select count(*) from public.pacientes where activo)::int as pacientes_activos,
  (select count(*) from public.ong_predios where activo is not false)::int as predios_activos
where public.mi_rol() <> all (array['sin_perfil','demo']);

revoke all on public.cupo_conteos from anon;
grant select on public.cupo_conteos to authenticated;

-- Control, despues de tocar policies y vistas:
--   select count(*) from pg_policies where schemaname='public' and qual='true';  -- 0
--   select c.relname, has_table_privilege('anon','public.'||c.relname,'SELECT')
--     from pg_class c join pg_namespace n on n.oid=c.relnamespace
--    where n.nspname='public' and c.relkind='v';                                 -- todas false
