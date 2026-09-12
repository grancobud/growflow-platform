-- Ligar cada orden de servicio con su lote.
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- Aparecio revisando la hoja INGRESOS. Esa hoja tiene columnas separadas para
-- Producto/Servicio, Lote, Cantidad, Costo Unitario y SALDO, y el mapper del
-- Apps Script las aplasta TODAS dentro de `descripcion`:
--
--   "MPK - lote MPK-L3112 - 25 gr/ud a $7000 c/u - SALDO PENDIENTE $..."
--
-- El saldo ya se rescato con `ong_pagos_proveedor` y las vistas. Lo que seguia
-- perdido era el lote: con el codigo adentro de una oracion no se puede
-- preguntar de que orden vino un lote, que es LA pregunta de trazabilidad.
--
-- El texto se recupera sin ambiguedad: de las 124 ordenes, 115 tienen codigo de
-- lote y las 115 matchean un lote real. Cero huerfanos.

alter table public.ong_documentos
  add column if not exists lote_codigo text;

comment on column public.ong_documentos.lote_codigo is
  'Lote que trajo esta orden de servicio. Cruza contra ong_lotes.codigo.';

-- Backfill desde la descripcion. Solo escribe donde matchea un lote que EXISTE:
-- un codigo suelto que no corresponde a nada es peor que no tener nada.
update public.ong_documentos d
   set lote_codigo = l.codigo
  from public.ong_lotes l
 where d.categoria = 'Aprovisionamiento'
   and d.lote_codigo is null
   and l.codigo = nullif(btrim((regexp_match(d.descripcion, 'lote\s+([^·|]+?)\s*(·|$)'))[1]), '');

create index if not exists ix_ong_documentos_lote on public.ong_documentos (lote_codigo);

-- La vista pasa a mostrarlo, asi la pantalla no vuelve a parsear texto.
--
-- Se respeta la definicion que ya estaba: el WHERE filtra por `numero` no vacio
-- (NO por categoria) y el GROUP BY mantiene separadas dos ordenes que compartan
-- numero pero difieran en fecha o monto. Cambiar eso aca seria meter un cambio
-- de semantica de contrabando en una migracion que agrega una columna.
--
-- OJO, BUG PREEXISTENTE QUE NO SE TOCA: el join de pagos es por `numero`, asi
-- que si un numero esta repetido, los pagos se cuentan una vez POR CADA fila.
-- Hoy no rompe nada porque el unico repetido (OS38) tiene cero pagos, pero el
-- dia que le paguen el `pagado` va a salir duplicado. El cruce nuevo de
-- Coherencia avisa del numero repetido; arreglar la vista necesita antes que
-- la asociación decida si son dos ordenes distintas o una cargada dos veces.
drop view if exists public.v_saldo_ordenes;
create view public.v_saldo_ordenes
with (security_invoker = on) as
 SELECT d.numero AS orden_servicio,
    d.proveedor,
    d.fecha,
    d.lote_codigo,
    d.monto AS total,
    COALESCE(sum(p.monto), 0::numeric) AS pagado,
    d.monto - COALESCE(sum(p.monto), 0::numeric) AS saldo,
    count(p.id) AS pagos
   FROM public.ong_documentos d
     LEFT JOIN public.ong_pagos_proveedor p ON p.orden_servicio = d.numero
  WHERE d.numero IS NOT NULL AND d.numero <> ''::text AND d.monto IS NOT NULL
  GROUP BY d.numero, d.proveedor, d.fecha, d.lote_codigo, d.monto;

revoke all on public.v_saldo_ordenes from anon;
