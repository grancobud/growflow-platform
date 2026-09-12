-- Clasifica las 13 dispensas de agosto 2025 que quedaron sin `tipo_movimiento`.
--
-- SÓLO ESTAS TRECE, y no las 55 sin clasificar. Correr `tipoDeMovimiento()`
-- sobre el resto marcaría como `entrega` a 31 filas cuya `modalidad` dice
-- «Consumo interno», y clasificaría como material dos asientos de caja
-- (MIGRA-CAJA-EF/TRANSF), un cobro de trámite («Programa REPROCANN») y tres
-- ventas de parafernalia. Esas necesitan que la asociación decida qué fueron.
--
-- Por qué estas trece sí se pueden deducir: tienen aporte 0, gramos > 0, no
-- tienen paciente, y su `modalidad` coincide con la de las 108 filas que ya
-- están en `consumo_interno` y las 26 que ya están en `merma` —todas con
-- aporte 0—. El precedente es la propia base, no una interpretación.
--
-- `modalidad` NO es autoridad en general: el valor `retiro` está repartido en
-- seis tipos distintos. Lo que la vuelve confiable acá es la combinación con
-- aporte 0, que es justo lo que separa el consumo real de la venta.

update public.ong_dispensas
   set tipo_movimiento = case modalidad
         when 'Consumo interno' then 'consumo_interno'
         when 'Merma'           then 'merma'
       end
 where tipo_movimiento is null
   and coalesce(aporte, 0) = 0
   and coalesce(gramos, 0) > 0
   and paciente_id is null
   and modalidad in ('Consumo interno', 'Merma');

-- SELECT de control que CUENTA, porque un UPDATE que toca cero filas devuelve
-- «Success» igual. Es el pozo del backfill de DNI, que matcheaba por una
-- columna que ya no era y no tocó nada sin avisar.
do $$
declare
  restantes int;
  clasificadas int;
begin
  select count(*) into restantes
    from public.ong_dispensas where tipo_movimiento is null;

  select count(*) into clasificadas
    from public.ong_dispensas
   where tipo_movimiento in ('consumo_interno', 'merma')
     and fecha between '2025-08-01' and '2025-08-31'
     and paciente_id is null
     and coalesce(aporte, 0) = 0;

  if restantes <> 42 then
    raise exception 'Se esperaban 42 sin clasificar y quedaron %. Revisar antes de seguir.', restantes;
  end if;

  raise notice 'Clasificadas 13 de agosto 2025. Sin clasificar: % (eran 55).', restantes;
  raise notice 'Consumo interno + merma de ago-2025 sin paciente: %', clasificadas;
end $$;
