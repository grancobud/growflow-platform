-- pacientes_min dejaba ver los nombres de los pacientes a quien no tiene perfil.
--
-- La vista se creo el 19/08 (migracion suelta `roles_pacientes_ficha_clinica`,
-- aplicada por fuera del repo: hasta hoy no habia archivo para ella) con este
-- filtro:
--
--     where mi_rol() <> 'demo'
--
-- En ese momento los unicos roles eran los reales y 'demo'. Despues aparecio
-- 'sin_perfil' —el que devuelve mi_rol() cuando el usuario no tiene perfil, o lo
-- tiene inactivo— y el filtro nunca se actualizo. `<> 'demo'` lo deja pasar.
--
-- Efecto: como el registro de Supabase es abierto y `authenticated` tiene SELECT
-- sobre la vista, CUALQUIERA que se creara una cuenta —sin que nadie se la
-- aprobara— veia la lista completa de nombres de pacientes. En la asociación son 223.
-- Es justo lo contrario de lo que declara el resumen de roles del 19/08: "Un
-- usuario sin perfil, o con perfil inactivo, es 'sin_perfil': no ve nada".
--
-- Ademas en Chaco la vista todavia tenia SELECT para `anon`, o sea sin siquiera
-- registrarse. Ahi no llego a filtrarse nada porque la base tiene 0 pacientes,
-- pero era cuestion de cargar el primero. En la asociación ese grant ya estaba sacado a
-- mano; como la vista no vivia en el repo, la clonacion del 24/08 se llevo el
-- estado viejo. Por eso ahora la vista SI queda escrita aca.
--
-- El arreglo es alinear el filtro al idiom que ya usa todo el resto del esquema
-- (ambiente_lecturas, cultivo_areas, lotes, tarifas, pagos_proveedor):
--
--     mi_rol() <> all (array['sin_perfil','demo'])
--
-- Los cinco roles reales —administrador, cultivador, director_medico,
-- administrativo, auditor— siguen viendo los nombres igual que antes. No cambia
-- para nadie que deba estar adentro.
--
-- OJO, ESTA VISTA ES SECURITY DEFINER A PROPOSITO. No ponerle security_invoker.
-- El RLS de `pacientes` es `puede_ver_clinico()`, que son solo administrador y
-- director_medico. pacientes_min existe justamente para que cultivador,
-- administrativo y auditor vean el NOMBRE sin ver la ficha clinica: si corriera
-- con los permisos del que consulta, esos tres verian cero filas y se romperia
-- la columna "nombres" de la tabla de roles. Su barrera es el WHERE de aca
-- adentro, no el RLS de abajo.
--
-- El linter de Supabase la marca igual como ERROR `security_definer_view`. En
-- este caso es un falso positivo conocido: es el unico que queda y se ignora a
-- proposito. No "arreglarlo" poniendole la opcion.
--
-- (Distinto de v_saldo_ordenes / v_saldo_proveedores, que SI deben ser
-- security_invoker — ver 20260824180000.)
--
-- Aplicar en la asociación (qivhrbsnvuaylqofpjti) y en Cultivando Salud Chaco
-- (gjzzohwpdxqhpgkhbyan). NO en la base de Gaston (rtnidtpalynprizpbnuz).

create or replace view public.pacientes_min as
select id,
       nombre_completo,
       activo,
       socio
  from public.pacientes
 where mi_rol() <> all (array['sin_perfil','demo']);

-- La vista es la puerta para los roles que no ven la ficha; el anonimo no es uno
-- de ellos. Idempotente a proposito: la asociación ya lo tenia, Chaco no.
revoke all on public.pacientes_min from anon;

grant select on public.pacientes_min to authenticated;
