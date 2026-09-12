-- Borrar un usuario le borraba los lotes. Era una bomba y estaba armada.
--
-- 31/08/2026. Gaston pidio poder eliminar usuarios —hasta hoy solo se podia
-- borrar a quien nunca habia entrado—. Antes de tocar la regla se miro que se
-- lleva puesto un borrado, y aparecio esto:
--
--   tabla         columna    al borrar el usuario
--   ong_lotes     user_id    CASCADE      <-- se borran los lotes
--   ong_pedidos   user_id    CASCADE      <-- se borran los pedidos
--
-- Y medido contra los datos reales, el alcance:
--
--   admin@ejemplo.org   administrador          105 lotes, 1.248 dispensas
--   soporte@ejemplo.org administrador_sistema    0 lotes,     0 dispensas
--
-- O sea que borrar la cuenta de la asociacion habria borrado LOS 105 LOTES —el
-- inventario entero— y dejado las 1.248 entregas apuntando a un `lote_codigo`
-- que ya no existe. Las dispensas no se habrian ido con ellos, porque enganchan
-- por TEXTO y no por FK: habrian quedado huerfanas, que es exactamente lo que
-- cuenta el cruce `lote_codigo_huerfano`. La traza del material se cortaba
-- entera y ningun total lo habria delatado.
--
-- Abrir el borrado sin arreglar esto habria sido poner un boton de perder
-- datos, con el nombre de otra cosa.
--
-- SET NULL Y NO RESTRICT. Restrict haria que la cuenta de la asociacion sea
-- imborrable, que suena bien pero mueve el problema: la barrera de quien se
-- puede borrar es una decision de producto y vive en `usuarios-eliminar`, no en
-- una FK. Aca lo que se decide es otra cosa: que una fila NO desaparezca porque
-- se fue quien la cargo.
--
-- POR ESO `user_id` PASA A SER NULLABLE. Null no es «faltante»: es «no se sabe
-- quien lo cargo, porque esa cuenta ya no esta». Es un estado real del dato y
-- tiene que poder representarse. Lo que se pierde al borrar es la firma, no la
-- fila, y eso es lo que el aviso de la pantalla dice antes de confirmar.

alter table public.ong_lotes   alter column user_id drop not null;
alter table public.ong_pedidos alter column user_id drop not null;

alter table public.ong_lotes   drop constraint if exists ong_lotes_user_id_fkey;
alter table public.ong_lotes   add  constraint ong_lotes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.ong_pedidos drop constraint if exists ong_pedidos_user_id_fkey;
alter table public.ong_pedidos add  constraint ong_pedidos_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

comment on column public.ong_lotes.user_id is
  'Quien lo cargo. Nullable desde el 31/08/2026: null es «no se sabe» porque se borro el usuario. Era CASCADE y borrar una cuenta se llevaba sus lotes.';
comment on column public.ong_pedidos.user_id is
  'Quien lo cargo. Nullable: null es «no se sabe» porque se borro el usuario.';

-- Control. La unica CASCADE que tiene que quedar contra auth.users en `public`
-- es `perfiles_usuario.id`, que si corresponde: el perfil se va con la cuenta.
--
--   select c.conrelid::regclass, a.attname, c.confdeltype
--     from pg_constraint c
--     join unnest(c.conkey) with ordinality k(attnum, ord) on true
--     join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
--    where c.contype='f' and c.confrelid='auth.users'::regclass
--      and c.connamespace='public'::regnamespace;
