-- v_saldo_ordenes tomaba de ong_documentos CUALQUIER documento con numero y monto, sin
-- mirar el tipo. Mientras los recibos de dispensa no estaban numerados no se notaba;
-- al emitir los 846 recibos de reembolso, cada uno entro a la vista como si fuera una
-- orden de compra a un proveedor.
--
-- Efecto: la deuda con proveedores figuraba en $XX.XXX.XXX cuando son $XX.XXX.XXX. Los
-- $XX.XXX.XXX de diferencia son los recibos —agrupados bajo "Sin proveedor", porque un
-- recibo a un socio no tiene proveedor, que era la pista—. Eso inflaba los costos
-- operativos de la cadena de justificacion a $XXX.XXX.XXX y hacia decir que faltaban
-- $XX.XXX.XXX para cubrirlos.
--
-- El monto correcto se verifica contra la planilla de Drive, que declara $XX.XXX.XXX de
-- saldo a pagar: $XX.XXX de diferencia sobre $32,4 M.
--
-- Una orden de servicio es un GASTO. Filtrar por tipo es lo que faltaba.

create or replace view v_saldo_ordenes as
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
where d.numero is not null and d.numero <> '' and d.monto is not null
  and d.tipo = 'gasto'
group by d.numero, d.proveedor, d.fecha, d.lote_codigo, d.monto;
