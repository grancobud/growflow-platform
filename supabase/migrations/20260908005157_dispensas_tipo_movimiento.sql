-- Nombrar el movimiento.
--
-- Hasta ahora una fila de `ong_dispensas` mezclaba seis hechos distintos y solo
-- se distinguian mirando si algun numero daba cero: una entrega normal, un
-- retiro a cuenta, un cobro de deuda, el consumo interno, una merma y un ajuste
-- de stock. Por eso el balance de materia marcaba como error una operacion
-- normal, y el promedio de aporte por gramo se envenenaba con cobros que no
-- tienen gramos.
--
-- Lo confirmo la asociación el 08/09/2026: la plata que entra sin salir gramos es el
-- pago de una deuda; los gramos que salen sin entrar plata son un retiro a
-- cuenta.
--
-- NULLABLE A PROPOSITO: null es "todavia no se clasifico", no un tipo mas.
-- Mismo criterio que `ong_lotes.costo_por_gramo`, donde null es "no lo se" y
-- no cero.
alter table public.ong_dispensas
  add column if not exists tipo_movimiento text;

alter table public.ong_dispensas
  drop constraint if exists ong_dispensas_tipo_movimiento_check;

alter table public.ong_dispensas
  add constraint ong_dispensas_tipo_movimiento_check
  check (tipo_movimiento is null or tipo_movimiento = any (array[
    'entrega',            -- sale material y entra el aporte, todo junto
    'entrega_a_cuenta',   -- sale material, el socio queda debiendo
    'cobro_de_deuda',     -- entra plata por entregas anteriores, no sale material
    'consumo_interno',    -- CI: sale material y no hay socio del otro lado
    'merma',              -- perdida de material
    'ajuste'              -- correccion de stock, no es una operacion con nadie
  ]));

comment on column public.ong_dispensas.tipo_movimiento is
  'Que fue este movimiento. null = sin clasificar. Un cobro_de_deuda no lleva gramos y una entrega_a_cuenta no lleva aporte: los dos son normales y no hay que contarlos como error.';

create index if not exists ong_dispensas_tipo_movimiento_idx
  on public.ong_dispensas (tipo_movimiento);

-- Backfill de lo que los numeros dicen sin ambiguedad. Consumo interno, merma y
-- ajuste NO se deducen: los tres se parecen a una entrega a cuenta, y forzarlos
-- escribiria una mentira. En una base nueva esto no toca nada.
update public.ong_dispensas set tipo_movimiento = 'cobro_de_deuda'
 where tipo_movimiento is null and gramos = 0 and coalesce(aporte, 0) > 0;

update public.ong_dispensas set tipo_movimiento = 'entrega_a_cuenta'
 where tipo_movimiento is null and gramos > 0 and coalesce(aporte, 0) = 0
   and paciente_id is not null;

update public.ong_dispensas set tipo_movimiento = 'entrega'
 where tipo_movimiento is null and gramos > 0 and coalesce(aporte, 0) > 0;
