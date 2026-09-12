-- Registra los traslados de proveedor a sede que ya ocurrieron.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- Cada orden de servicio es una compra que fisicamente VIAJO del proveedor a la
-- sede. `ong_traslados` estaba en 0.
--
-- LA FECHA SALE DE LA ORDEN, no del lote: los 94 lotes comprados tienen
-- fecha_elaboracion = 2026-08-20, la del backfill, no la de llegada. Usarla
-- daria 10 traslados el mismo dia. La orden tiene la fecha real.
--
-- Se agrupa por (proveedor, fecha): varios lotes del mismo proveedor el mismo
-- dia viajaron juntos. 123 ordenes -> 102 viajes, 15 proveedores.
--
-- `carta_porte_presentada` queda en FALSE a proposito. Ese flag dice que se
-- presento la DDJJ por TAD ANTE EL ESTADO. El traslado ocurrio —eso es cierto y
-- se registra— pero la carta no se presento. El documento SI se puede emitir e
-- imprimir; lo que no se puede es declarar que ya se presento.
insert into public.ong_traslados
  (fecha, origen, destino, tipo_material, cantidad, carta_porte_presentada, notas)
select d.fecha, d.proveedor, 'Sede social',
       case when max(l.unidad) = 'u' then 'frascos' else 'flores' end,
       sum(coalesce(l.gramos_totales, 0)), false,
       'Generado desde ' || count(*) || ' orden(es) de servicio: ' ||
         string_agg(d.numero, ', ' order by d.numero)
  from public.ong_documentos d
  left join public.ong_lotes l on l.codigo = d.lote_codigo
 where d.categoria = 'Aprovisionamiento' and d.fecha <= current_date
   and d.proveedor is not null and btrim(d.proveedor) <> ''
   and not exists (select 1 from public.ong_traslados t
                    where t.fecha = d.fecha and t.origen = d.proveedor)
 group by d.fecha, d.proveedor;
