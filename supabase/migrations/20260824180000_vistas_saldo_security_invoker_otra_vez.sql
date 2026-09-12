-- Las dos vistas de saldo volvieron a quedar SIN security_invoker. Segunda vez.
--
-- El 20/08 la migracion 20260820000012 las cerro con `alter view ... set
-- (security_invoker = on)`. El 24/08 volvieron a estar abiertas: el linter de
-- Supabase las marcaba como ERROR `security_definer_view` y en pg_class tenian
-- reloptions = null.
--
-- POR QUE PASO — la trampa, que es la razon de ser de este comentario:
--
--   `CREATE OR REPLACE VIEW` SIN la clausula `WITH (...)` BORRA las reloptions
--   que la vista ya tenia. No las conserva. No avisa. La vista sigue andando
--   igual, devolviendo las mismas filas, y en silencio vuelve a correr con los
--   permisos de su DUENO (postgres) en vez de los del que consulta.
--
-- O sea: alcanza con tocar el SELECT de una vista para reabrirla. Paso dos
-- veces el 24/08, en dos migraciones que solo querian arreglar el calculo:
--
--   20260824040000_proveedores_incluye_los_de_lotes.sql  -> v_saldo_proveedores
--   20260824140000_saldo_ordenes_solo_gastos.sql         -> v_saldo_ordenes
--
-- Ninguna de las dos tenia nada que ver con permisos, y las dos los rompieron.
--
-- Efecto de tenerlas abiertas: se saltean el RLS de ong_documentos,
-- ong_pagos_proveedor y ong_lotes. Hoy `anon` no tiene SELECT sobre las vistas
-- (eso lo saco la migracion del 20/08 y sigue en pie), asi que la deuda con
-- proveedores no queda publica como en agosto; pero cualquier usuario logueado
-- ve TODO, sin importar lo que su RLS le permita en las tablas de abajo.
--
-- LA REGLA, para que no haya una tercera vez:
--
--   Toda vista sobre datos con RLS se define SIEMPRE con
--   `WITH (security_invoker = 'true')` en el propio CREATE OR REPLACE.
--   Nunca con un `alter view ... set` aparte, porque ese alter queda lejos y el
--   siguiente que edite el SELECT no lo va a ver. La opcion tiene que viajar
--   pegada a la definicion.
--
-- Comparar contra public.resumen_plantas, que nacio con la opcion en su propio
-- CREATE y por eso nunca la perdio.
--
-- Aplicar en la asociación (qivhrbsnvuaylqofpjti) y en Cultivando Salud Chaco
-- (gjzzohwpdxqhpgkhbyan), que clono el esquema el 24/08/2026 y heredo el
-- problema. NO aplicar en la base de Gaston (rtnidtpalynprizpbnuz): ahi estas
-- vistas no existen.
--
-- Las definiciones de abajo salen tal cual de pg_get_viewdef() sobre la asociación: no
-- cambia ni una fila, esto es solo el envoltorio de permisos.

-- Primero v_saldo_ordenes: v_saldo_proveedores depende de ella.
create or replace view public.v_saldo_ordenes
with (security_invoker = 'true') as
select d.numero as orden_servicio,
    d.proveedor,
    d.fecha,
    d.lote_codigo,
    d.monto as total,
    coalesce(sum(p.monto), 0::numeric) as pagado,
    d.monto - coalesce(sum(p.monto), 0::numeric) as saldo,
    count(p.id) as pagos
   from ong_documentos d
     left join ong_pagos_proveedor p on p.orden_servicio = d.numero
  where d.numero is not null and d.numero <> ''::text and d.monto is not null and d.tipo = 'gasto'::text
  group by d.numero, d.proveedor, d.fecha, d.lote_codigo, d.monto;

create or replace view public.v_saldo_proveedores
with (security_invoker = 'true') as
 with de_ordenes as (
         select coalesce(v_saldo_ordenes.proveedor, 'Sin proveedor'::text) as proveedor,
            count(*) as ordenes,
            sum(v_saldo_ordenes.total) as comprado,
            sum(v_saldo_ordenes.pagado) as pagado,
            sum(v_saldo_ordenes.saldo) as saldo,
            count(*) filter (where v_saldo_ordenes.saldo > 0::numeric) as ordenes_con_saldo
           from v_saldo_ordenes
          group by (coalesce(v_saldo_ordenes.proveedor, 'Sin proveedor'::text))
        ), de_lotes as (
         select distinct btrim(ong_lotes.proveedor) as proveedor
           from ong_lotes
          where ong_lotes.proveedor is not null and btrim(ong_lotes.proveedor) <> ''::text
        )
 select coalesce(o.proveedor, l.proveedor) as proveedor,
    coalesce(o.ordenes, 0::bigint) as ordenes,
    coalesce(o.comprado, 0::numeric) as comprado,
    coalesce(o.pagado, 0::numeric) as pagado,
    coalesce(o.saldo, 0::numeric) as saldo,
    coalesce(o.ordenes_con_saldo, 0::bigint) as ordenes_con_saldo
   from de_ordenes o
     full join de_lotes l on l.proveedor = o.proveedor;

-- Repetir los permisos por las dudas: CREATE OR REPLACE los conserva, pero si
-- alguna base quedo a medio camino esto la deja igual que las demas.
revoke all on public.v_saldo_ordenes     from anon;
revoke all on public.v_saldo_proveedores from anon;

grant select on public.v_saldo_ordenes     to authenticated;
grant select on public.v_saldo_proveedores to authenticated;
