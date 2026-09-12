-- LA DEUDA SE DECLARA, NO SE DEDUCE.
--
-- Lo intuitivo seria calcularla como gramos x tarifa, y no funciona: la tarifa
-- SUGIERE pero no impone, y 703 de 704 aportes son multiplos de $X.XXX. O sea
-- que cobran en pesos redondos y la tarifa por gramo es el RESULTADO, no la
-- entrada. Una deuda deducida de la tarifa es un numero que nadie firmo, y el
-- primer socio que lo discuta se lleva puesta la confianza en la pantalla.
--
-- `aporte` es lo que efectivamente entro. `aporte_esperado` es lo que se acordo
-- cobrar por esa entrega. La deuda es la resta, y es aritmetica exacta.
--
-- NULLABLE A PROPOSITO, y esta vez importa mas que nunca: null es "no se cuanto
-- se acordo", y las 198 entregas a cuenta que ya estan cargadas nacen asi. Un
-- cero diria "se acordo no cobrar nada", que es una condonacion y no un dato
-- faltante.
alter table public.ong_dispensas
  add column if not exists aporte_esperado numeric;

alter table public.ong_dispensas
  drop constraint if exists ong_dispensas_aporte_esperado_check;

alter table public.ong_dispensas
  add constraint ong_dispensas_aporte_esperado_check
  check (aporte_esperado is null or aporte_esperado >= 0);

comment on column public.ong_dispensas.aporte_esperado is
  'Lo que se acordo cobrar por esta entrega. La deuda es aporte_esperado - aporte. null = no se sabe cuanto se acordo, que NO es lo mismo que cero.';

-- La app no lee la tabla, lee la vista. Una columna nueva no llega sola, y va
-- al final: create or replace view renombra por posicion.
create or replace view public.dispensas_segun_rol as
 SELECT id, user_id, paciente_id, fecha, producto, genetica_id, gramos, unidad,
    modalidad, entregado_por, con_receta, notas, creado_en, recibo_numero,
    lote_codigo,
        CASE WHEN puede_ver_plata() THEN aporte ELSE NULL::numeric END AS aporte,
        CASE WHEN puede_ver_plata() THEN medio_pago ELSE NULL::text END AS medio_pago,
        CASE WHEN puede_ver_plata() THEN pago_referencia ELSE NULL::text END AS pago_referencia,
        CASE WHEN puede_ver_plata() THEN aporte_desglose ELSE NULL::jsonb END AS aporte_desglose,
    tipo_movimiento,
    -- Es plata: quien no ve plata no ve cuanto se le debe a la asociacion.
        CASE WHEN puede_ver_plata() THEN aporte_esperado ELSE NULL::numeric END AS aporte_esperado
   FROM ong_dispensas
  WHERE mi_rol() = ANY (ARRAY['administrador'::text, 'administrador_sistema'::text, 'director_medico'::text, 'administrativo'::text, 'auditor'::text]);

revoke all on public.dispensas_segun_rol from anon;
grant select on public.dispensas_segun_rol to authenticated;
