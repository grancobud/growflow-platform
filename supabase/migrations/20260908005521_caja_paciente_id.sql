-- Un cobro de deuda no deberia fabricar una dispensa fantasma.
--
-- Hasta ahora, para registrar que un socio pago lo que adeudaba, habia que
-- inventar una fila de `ong_dispensas` de 0 gramos: la plata ya vivia en la
-- caja y la dispensa existia solo para colgarle el asiento. Con esta columna el
-- asiento se ata al socio directo, y el balance de materia deja de tener que
-- ignorar filas que no mueven material.
--
-- ON DELETE SET NULL, nunca CASCADE: archivar o borrar una ficha no puede
-- llevarse puesta la plata que esa persona pago.
alter table public.ong_caja
  add column if not exists paciente_id uuid references public.pacientes(id) on delete set null;

create index if not exists ong_caja_paciente_id_idx
  on public.ong_caja (paciente_id) where paciente_id is not null;

comment on column public.ong_caja.paciente_id is
  'El socio del otro lado del movimiento, cuando lo hay. Lo usa el cobro de deuda: plata que entra por entregas anteriores, sin material saliendo hoy.';
