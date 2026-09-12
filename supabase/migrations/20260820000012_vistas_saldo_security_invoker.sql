-- Cerrar las dos vistas de saldo, que nacieron abiertas.
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- Una vista en Postgres corre con los permisos de SU DUENO, no del que la
-- consulta: sin `security_invoker` se saltea el RLS de `ong_documentos` y
-- `ong_pagos_proveedor`. Y PostgREST le da SELECT a `anon` por defecto.
--
-- O sea que la deuda con proveedores —$32M, 20 proveedores— quedaba legible SIN
-- AUTENTICAR. Aparecio al ir a leer las vistas desde la app, en el commit
-- siguiente al que las creo.
--
-- LA REGLA: crear una vista NO es como crear una tabla. Una tabla nueva sin
-- policies no la lee nadie; una vista nueva la lee cualquiera. Toda vista sobre
-- datos con RLS necesita las dos lineas de abajo, y hay que verificarlo con
-- has_table_privilege('anon', ...) despues de crearla.

alter view public.v_saldo_ordenes     set (security_invoker = on);
alter view public.v_saldo_proveedores set (security_invoker = on);

revoke all on public.v_saldo_ordenes     from anon;
revoke all on public.v_saldo_proveedores from anon;

grant select on public.v_saldo_ordenes     to authenticated;
grant select on public.v_saldo_proveedores to authenticated;
