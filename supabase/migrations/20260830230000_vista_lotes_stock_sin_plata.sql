-- El stock de cada lote, SIN lo que cuesta.
--
-- Ya aplicado a mano sobre qivhrbsnvuaylqofpjti el 30/08/2026. NO en Chaco.
--
-- POR QUE UNA VISTA Y NO ABRIRLE `ong_lotes` AL CULTIVADOR
--
-- Esa tabla mezcla dos cosas: cuanto material hay —que es trabajo del cultivo— y
-- cuanto sale el gramo, que es plata. Tenia `costo_por_gramo` cargado en 97 de
-- 105 lotes, a $X.XXX el gramo promedio: $XX.XXX.XXX de material valorizado.
-- Darle la tabla entera al cultivador para que vea el stock seria entregarle eso
-- de paso.
--
-- Y el RLS no sabe de columnas: una policy deja pasar la fila entera o ninguna.
-- Los GRANT por columna tampoco sirven, porque todos los usuarios de la app
-- entran con el MISMO rol de Postgres (`authenticated`) y el rol de la
-- asociacion vive en una tabla, no en el motor.
--
-- EL `where` ES LA PUERTA, NO UN FILTRO
--
-- Las vistas no tienen RLS propio, y esta corre con los permisos de su dueno (no
-- lleva `security_invoker`), o sea que pasa por encima del RLS de `ong_lotes` y
-- `ong_dispensas` — que es lo que se busca: dejar entrar al cultivador, que a
-- esas tablas no entra. Sacar el `where` abre el stock a cualquiera con cuenta.
--
-- LO ENTREGADO VIENE SUMADO POR LOTE
--
-- Para saber que queda hay que restar lo que salio, y eso vive en
-- `ong_dispensas`, donde esta a que paciente se le dio y cuanto aporto. Aca sale
-- sumado: «de este lote salieron 400 g». Es el dato que el cultivo necesita, sin
-- una sola fila que diga a quien.
--
-- `restante` puede dar NEGATIVO y se deja asi: significa que se entrego mas de
-- lo que el lote declara. Recortarlo a cero esconderia el problema.
--
-- Verificado ejecutando COMO cultivador: ve 105 filas de `lotes_stock` y CERO de
-- `ong_lotes`, `ong_dispensas`, `pacientes` y `ong_caja`.

create or replace view public.lotes_stock as
select
  l.id, l.codigo, l.producto, l.genetica_id, l.cosecha_id,
  l.gramos_totales, l.unidad, l.fecha_elaboracion, l.origen, l.proveedor, l.activo,
  -- El analisis es trazabilidad, no plata: dice que tiene adentro el material.
  l.thc_pct, l.cbd_pct, l.laboratorio, l.fecha_analisis, l.analisis_path,
  l.notas, l.creado_en,
  coalesce(d.entregado, 0) as entregado,
  l.gramos_totales - coalesce(d.entregado, 0) as restante
from public.ong_lotes l
left join (
  -- Normalizado: `ong_dispensas` engancha por texto escrito a mano, asi que
  -- comparar crudo deja `CO-01` y `co-01 ` como lotes distintos.
  select upper(trim(lote_codigo)) cod, sum(coalesce(gramos, 0)) entregado
  from public.ong_dispensas
  where lote_codigo is not null and trim(lote_codigo) <> ''
  group by 1
) d on d.cod = upper(trim(l.codigo))
where public.mi_rol() <> all (array['sin_perfil'::text, 'demo'::text]);

comment on view public.lotes_stock is
  'Lotes con entrado/entregado/restante, SIN las columnas de plata y SIN una sola '
  'fila de a quien se le entrego. Es lo que ve el cultivo. El `where` es la puerta.';

revoke all on public.lotes_stock from public;
grant select on public.lotes_stock to authenticated;
