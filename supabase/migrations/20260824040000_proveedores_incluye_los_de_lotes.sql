-- La lista de proveedores mostraba solo a quienes se les compro CON ORDEN.
--
-- v_saldo_proveedores salia de v_saldo_ordenes, que sale de los documentos con
-- numero de orden. Un proveedor del que entro material pero cuyo comprobante
-- nunca se cargo NO aparecia en ningun lado: el 24/08/2026 fue el caso de Tanex,
-- que tiene el lote TANEX-L01 con 22 g y ninguna orden.
--
-- Eso es un hueco del diseño, no de la carga: alguien de quien se recibio
-- material ES un proveedor, tenga o no el papel. Y esconderlo es justo al reves
-- de lo que conviene — el que NO tiene comprobante es el que hay que ver.
--
-- Ahora la lista los incluye con la compra en cero, asi que se distinguen solos:
-- un proveedor con ordenes en 0 y lotes a su nombre es uno al que le falta la
-- documentacion de compra.
--
-- Las columnas son las mismas y en el mismo orden: Economia y la cadena de
-- justificacion siguen leyendo igual.

create or replace view public.v_saldo_proveedores as
with de_ordenes as (
  select coalesce(proveedor, 'Sin proveedor'::text) as proveedor,
         count(*) as ordenes,
         sum(total) as comprado,
         sum(pagado) as pagado,
         sum(saldo) as saldo,
         count(*) filter (where saldo > 0::numeric) as ordenes_con_saldo
  from public.v_saldo_ordenes
  group by 1
),
de_lotes as (
  select distinct btrim(proveedor) as proveedor
  from public.ong_lotes
  where proveedor is not null and btrim(proveedor) <> ''
)
select coalesce(o.proveedor, l.proveedor) as proveedor,
       coalesce(o.ordenes, 0::bigint) as ordenes,
       coalesce(o.comprado, 0::numeric) as comprado,
       coalesce(o.pagado, 0::numeric) as pagado,
       coalesce(o.saldo, 0::numeric) as saldo,
       coalesce(o.ordenes_con_saldo, 0::bigint) as ordenes_con_saldo
from de_ordenes o
full outer join de_lotes l on l.proveedor = o.proveedor;
