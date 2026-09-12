-- Le pone a cada lote su fecha real de ingreso. SOLO PARA LA BASE DE ASOCIACION.
--
-- LOS 101 LOTES TENIAN fecha_elaboracion = 2026-08-20, la del backfill. No es
-- una imprecision: es imposible. 100 de los 101 tenian dispensas ANTERIORES a
-- su propia fecha de elaboracion — material entregado antes de existir, desde
-- 2025-08-02.
--
-- Los 101 tienen origen = 'comprado': ninguno es produccion propia, asi que la
-- fecha del lote en los libros de la cooperativa es la de INGRESO, no la de
-- elaboracion en un laboratorio que no es de ellos.
--
-- DE DONDE SALE, en este orden:
--   1. la orden de servicio que compro ese lote (96 lotes)
--   2. si no hay orden, la primera dispensa: el lote existia al menos ese dia
--      (5 lotes)
-- Se toma el MENOR de los dos cuando hay ambos, porque en 2 casos la orden es
-- posterior a la primera entrega. Asi ninguna entrega queda antes del ingreso.
--
-- Queda anotado en `notas` de donde salio cada fecha: nadie tiene que leer esto
-- como una fecha de elaboracion de laboratorio.
--
-- RESULTADO: rango 2025-08-02 a 2026-08-07, 0 con fecha de backfill,
-- 100 -> 0 lotes con entregas anteriores a su ingreso.
with orden as (
  select l.codigo, min(d.fecha) f
    from public.ong_lotes l
    join public.ong_documentos d
      on d.lote_codigo = l.codigo and d.categoria = 'Aprovisionamiento'
   group by 1),
disp as (
  select l.codigo, min(d.fecha) f
    from public.ong_lotes l
    join public.ong_dispensas d on d.lote_codigo = l.codigo
   group by 1),
calc as (
  select l.id,
         least(coalesce(o.f, p.f), coalesce(p.f, o.f)) fecha,
         case when o.f is not null then 'orden de servicio'
              else 'primera entrega registrada' end fuente
    from public.ong_lotes l
    left join orden o on o.codigo = l.codigo
    left join disp  p on p.codigo = l.codigo
   where coalesce(o.f, p.f) is not null)
update public.ong_lotes l
   set fecha_elaboracion = c.fecha,
       notas = coalesce(nullif(btrim(l.notas),'') || ' | ', '') ||
               'Fecha de ingreso a la cooperativa segun ' || c.fuente ||
               ' (lote comprado: no hay fecha de elaboracion de origen).'
  from calc c
 where l.id = c.id;
