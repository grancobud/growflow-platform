-- Lo que retira el equipo no es deuda, es parte de su pago.
--
-- Socio (PAC-XXX) y Socio (PAC-XXX) concentraban 566 g de los 1.534 sin
-- cobrar: el 37%. Contarlos como entrega_a_cuenta les inventaba una deuda
-- millonaria a las dos personas que sostienen la sede.
--
-- Y tampoco es consumo_interno: CI es lo que consume la organizacion EN COMUN.
-- La retribucion es de una persona y es parte de su pago. Aplanarlas pierde la
-- unica de las dos que se puede valuar como gasto.
alter table public.ong_dispensas
  drop constraint if exists ong_dispensas_tipo_movimiento_check;

alter table public.ong_dispensas
  add constraint ong_dispensas_tipo_movimiento_check
  check (tipo_movimiento is null or tipo_movimiento = any (array[
    'entrega',                 -- sale material y entra el aporte, todo junto
    'entrega_a_cuenta',        -- sale material, el socio queda debiendo
    'cobro_de_deuda',          -- entra plata por entregas anteriores, no sale material
    'retribucion_en_especie',  -- se lo lleva quien trabaja, como parte de su pago
    'consumo_interno',         -- CI: lo que consume la organizacion en comun
    'merma',                   -- perdida de material
    'ajuste'                   -- correccion de stock, no es una operacion con nadie
  ]));

-- LA REGLA VIVE EN LA FICHA, NO EN UNA LISTA DE CODIGOS.
--
-- Si dependiera de "PAC-XXX y PAC-XXX", el dia que entre alguien mas al equipo
-- sus retiros nacerian como deuda y nadie se enteraria hasta que alguien mire
-- una cuenta corriente y vea un numero que no existe.
alter table public.pacientes
  add column if not exists retira_como_retribucion boolean not null default false;

comment on column public.pacientes.retira_como_retribucion is
  'Quien trabaja en la asociacion y se lleva material como parte de su pago. Sus retiros sin aporte son retribucion_en_especie, no una deuda.';

-- Reclasificacion. En una base nueva no toca nada: nadie tiene la marca puesta.
update public.ong_dispensas d set tipo_movimiento = 'retribucion_en_especie'
  from public.pacientes p
 where p.id = d.paciente_id
   and p.retira_como_retribucion
   and d.tipo_movimiento = 'entrega_a_cuenta';
