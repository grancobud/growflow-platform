-- Los traslados dicen QUE material movieron.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- El pack de plantillas pide `{{lotes_geneticas_detalle}}` en la guia de
-- transito interno, y `{{producto_lote_codigo}}` en la DDJJ de transporte a
-- domicilio. `ong_traslados` no tenia de donde sacarlo: guardaba fecha, origen,
-- destino, tipo de material y cantidad, pero no que lote viajaba.
--
-- Una guia de transito que no dice que lote se movio no sirve para lo unico
-- para lo que existe. Si una inspeccion pregunta de donde salio el material que
-- esta en la sede, la respuesta tiene que poder seguirse hasta el lote; con
-- "40 g de flores" no se sigue a ningun lado.
--
-- EL DATO SE DERIVA, NO SE PIDE. `20260821060000_traslados_desde_ordenes` armo
-- los 102 viajes agrupando las ordenes de servicio por (proveedor, fecha).
-- Esas mismas ordenes tienen `lote_codigo`, asi que el vinculo ya existia: se
-- reagrupa con el mismo criterio con el que se creo el traslado. No es un match
-- aproximado, es la misma clave.
--
-- LA COLUMNA ES PLURAL. Un viaje puede traer varios lotes: cuando el proveedor
-- mando dos ordenes el mismo dia, viajaron juntas. Hay 10 traslados con mas de
-- un lote y el maximo es 4. Guardar un solo `lote_codigo` obligaria a elegir
-- uno y esconder los otros tres.
--
-- Se guarda el texto de los codigos y no una tabla puente porque es lo que se
-- imprime, y porque `ong_traslados` se edita a mano desde la pantalla: un
-- traslado cargado por el operador puede llevar lotes que no vienen de ninguna
-- orden.
--
-- LOS 6 QUE QUEDAN VACIOS. Tienen orden de servicio pero la orden no tiene
-- lote: son servicios y deudas, no compra de material. No se les inventa uno.
--
-- RESULTADO: 0 -> 96 traslados con su lote (86 con uno solo, 10 con varios).
alter table public.ong_traslados
  add column if not exists lotes text;

comment on column public.ong_traslados.lotes is
  'Codigos de lote que viajaron, separados por coma. Plural porque un viaje '
  'puede traer varias ordenes del mismo proveedor el mismo dia.';

update public.ong_traslados t
set lotes = s.lotes
from (
  select d.fecha, d.proveedor,
         string_agg(distinct d.lote_codigo, ', ' order by d.lote_codigo) lotes
    from public.ong_documentos d
   where d.categoria = 'Aprovisionamiento'
     and d.lote_codigo is not null
     and d.proveedor is not null
   group by d.fecha, d.proveedor
) s
where t.lotes is null
  and t.fecha = s.fecha
  and t.origen = s.proveedor;
