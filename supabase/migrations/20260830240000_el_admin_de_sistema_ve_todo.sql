-- `administrador_sistema` pasa a ver TODO, plata incluida.
--
-- Ya aplicado a mano sobre qivhrbsnvuaylqofpjti el 30/08/2026. NO en Chaco.
--
-- Decision de Gaston, cambiando la de esa misma manana: el rol habia nacido como
-- «administra todo MENOS la caja» y queda como «administra todo». El nombre lo
-- dice: es el administrador del sistema.
--
-- OJO AL LEER ESTO MAS ADELANTE: con este cambio el rol es funcionalmente
-- IDENTICO a `administrador`. Mismas tablas, mismos permisos. La diferencia pasa
-- a ser de etiqueta —cual es la cuenta de la asociacion y cual una persona que
-- administra—, no de acceso. Esta dicho a proposito para que nadie busque
-- despues una diferencia tecnica que no existe.
--
-- Antes de esto se habia arreglado tambien `puede_ver_clinico()`, que no lo
-- incluia: el rol veia la pestana Pacientes y la base le devolvia cero filas.
--
-- LO QUE NO SE TOCA, Y SIGUE SIRVIENDO: el filtro de pantallas por `ver_plata`
-- —`TABS_DE_PLATA` en la O.N.G. y el flag `plata` en Tablas—. Este rol ahora lo
-- pasa, pero sigue escondiendole la caja al `cultivador` y al `director_medico`,
-- que es para quienes se escribio.
--
-- Verificado ejecutando COMO el rol: caja 1741, documentos 1551, pagos 161,
-- tarifas 16, costos 5, pacientes 223, lotes 105, plantas 75.

create or replace function public.puede_ver_clinico()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.mi_rol() in ('administrador', 'administrador_sistema', 'director_medico');
$$;

create or replace function public.puede_ver_plata()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.mi_rol() in
    ('administrador', 'administrador_sistema', 'administrativo', 'auditor');
$$;

-- Y escribirla: las tablas de plata llevan la lista de roles a mano.
do $$
declare r record; q text; w text; tocadas int := 0;
begin
  for r in
    select tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') like '%''administrador''%'
        or coalesce(with_check,'') like '%''administrador''%')
      and coalesce(qual,'') not like '%administrador_sistema%'
      and coalesce(with_check,'') not like '%administrador_sistema%'
  loop
    q := replace(r.qual, '''administrador''::text',
                 '''administrador''::text, ''administrador_sistema''::text');
    w := replace(r.with_check, '''administrador''::text',
                 '''administrador''::text, ''administrador_sistema''::text');
    if r.with_check is null then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, q);
    else
      execute format('alter policy %I on public.%I using (%s) with check (%s)',
                     r.policyname, r.tablename, q, w);
    end if;
    tocadas := tocadas + 1;
  end loop;
  raise notice 'policies actualizadas: %', tocadas;
end $$;
