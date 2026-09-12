-- Respaldo completo de pacientes ANTES de fusionar los duplicados y limpiar el
-- import del formulario.
--
-- Se guardan las filas ENTERAS, no sólo las que voy a tocar: si mañana aparece
-- que el criterio de fusión fue el equivocado, con esto se puede reconstruir
-- cualquier ficha tal como estaba hoy. Es la clase de cambio que toca datos de
-- personas y no tiene "deshacer" en la app.
--
-- La tabla queda sin RLS habilitada a propósito NO: se le pone RLS y se le
-- niega todo al rol anon, igual que la tabla original. Un respaldo con los
-- mismos datos personales y sin las mismas defensas es una filtración esperando
-- que alguien encuentre el nombre.

create table if not exists public.pacientes_respaldo_20260825 as
select *, now() as respaldado_en from public.pacientes;

alter table public.pacientes_respaldo_20260825 enable row level security;

-- Sin políticas: con RLS habilitada y ninguna policy, nadie que pase por
-- PostgREST lee nada. Sólo se llega desde una conexión de servicio.
revoke all on public.pacientes_respaldo_20260825 from anon, authenticated;
