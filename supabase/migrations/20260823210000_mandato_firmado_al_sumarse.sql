-- El Mandato de Gestion Operativa, firmado en el momento de sumarse.
--
-- EL PROBLEMA
--
-- Al 23/08/2026 hay 209 asociados activos y CERO con el mandato firmado. No es
-- un papel mas: es el que sostiene que lo que la persona paga es el reembolso
-- del costo de un cultivo hecho por su cuenta, y no la compra de un producto.
-- Sin el, la regla RN-03 marca error en cada entrega, con este texto:
--
--     «Sin el, la entrega no tiene respaldo para sostener que es un reembolso
--      de costos y no una compraventa.»
--
-- Las columnas para guardarlo YA EXISTEN en ong_asociados —mandato_aceptado,
-- mandato_fecha, mandato_hora, ip_firma_mandato, mandato_version— desde que se
-- modelo la tabla. Nunca se uso porque no habia donde firmarlo: el alta la
-- tipeaba alguien a mano desde lo que le llegaba por otro canal.
--
-- Ahora que /sumate recibe la solicitud, el momento natural de firmarlo es ese:
-- la persona lo lee y lo acepta cuando pide el alta, y queda con fecha, hora y
-- version. Al aprobarse la solicitud, eso se copia al asociado.
--
-- LA FORMA, Y POR QUE ES ASI
--
-- Se mantiene todo lo que decidio la migracion de solicitudes: `anon` NO toca
-- la tabla, la unica puerta sigue siendo solicitud_crear(), y solicitud_estado()
-- sigue sin devolver el DNI. Lo unico que cambia es que la funcion acepta dos
-- datos mas.
--
-- LA VERSION DEL TEXTO SE GUARDA, y no es un detalle: si el mandato se
-- reescribe, quien firmo la version vieja firmo OTRA cosa. Sin el numero de
-- version no hay forma de saber despues que acepto cada persona.
--
-- LA IP NO SE PIDE ACA. La funcion corre en la base y ve la IP del pooler, no
-- la de la persona: guardarla seria guardar un dato falso con apariencia de
-- prueba. Queda en null hasta que haya un borde (Edge Function) que la vea de
-- verdad.

-- ---------------------------------------------------------------------------
-- 1 . La solicitud guarda lo que la persona acepto
-- ---------------------------------------------------------------------------

alter table public.ong_solicitudes
  add column if not exists mandato_aceptado boolean not null default false,
  add column if not exists mandato_version  text,
  add column if not exists mandato_fecha    timestamptz;

comment on column public.ong_solicitudes.mandato_aceptado is
  'Si la persona acepto el Mandato de Gestion Operativa al pedir el alta.';
comment on column public.ong_solicitudes.mandato_version is
  'Que version del texto acepto. Sin esto no se sabe QUE firmo si el mandato se reescribe.';

-- ---------------------------------------------------------------------------
-- 2 . solicitud_crear acepta la firma
--
-- Los dos parametros van AL FINAL y con default, asi la firma vieja de la
-- funcion sigue andando: un cliente todavia no desplegado la puede llamar sin
-- ellos y no se rompe nada.
-- ---------------------------------------------------------------------------

-- Se DROPEA la de cinco parametros antes de crear la de siete, y no es opcional:
-- Postgres sobrecarga por firma, asi que `create or replace` con dos parametros
-- mas no reemplaza a la vieja, crea otra al lado. Con las dos vivas, una llamada
-- de cinco argumentos queda ambigua —los nuevos tienen default— y la base
-- responde «function is not unique». Ademas la vieja no guarda la firma, asi que
-- todo cliente que quedara apuntandole daria de alta sin mandato en silencio.
drop function if exists public.solicitud_crear(text, text, text, text, text);

create or replace function public.solicitud_crear(
  p_nombre   text,
  p_dni      text,
  p_email    text default null,
  p_telefono text default null,
  p_notas    text default null,
  p_mandato_aceptado boolean default false,
  p_mandato_version  text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'Hace falta el nombre';
  end if;
  if coalesce(btrim(p_dni), '') = '' then
    raise exception 'Hace falta el DNI';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.ong_solicitudes
    (token, nombre, dni, email, telefono, notas, estado,
     mandato_aceptado, mandato_version, mandato_fecha)
  values
    (v_token, btrim(p_nombre), btrim(p_dni), nullif(btrim(p_email), ''),
     nullif(btrim(p_telefono), ''), nullif(btrim(p_notas), ''), 'pendiente',
     coalesce(p_mandato_aceptado, false),
     nullif(btrim(p_mandato_version), ''),
     -- La fecha la pone la base, no el cliente: una fecha de firma que manda
     -- quien firma no prueba nada.
     case when coalesce(p_mandato_aceptado, false) then now() else null end);

  return v_token;
end;
$$;

revoke all on function public.solicitud_crear(text, text, text, text, text, boolean, text) from public;
grant execute on function public.solicitud_crear(text, text, text, text, text, boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3 . Al aprobar la solicitud, la firma viaja al asociado
--
-- Es un trigger y no codigo del cliente a proposito: la firma tiene que llegar
-- al asociado por el mismo camino SIEMPRE, se apruebe desde la bandeja, desde
-- el alta automatica, o a mano por SQL.
-- ---------------------------------------------------------------------------

create or replace function public.solicitud_pasar_mandato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.asociado_id is not null
     and new.mandato_aceptado
     and (old.asociado_id is distinct from new.asociado_id)
  then
    update public.ong_asociados
       set mandato_aceptado = true,
           mandato_fecha    = coalesce(new.mandato_fecha::date, current_date),
           mandato_hora     = coalesce(new.mandato_fecha::time, current_time),
           mandato_version  = new.mandato_version
     where id = new.asociado_id
       -- Nunca pisar una firma que ya esta: si el asociado ya firmo, esa firma
       -- es la buena y la de la solicitud es vieja.
       and coalesce(mandato_aceptado, false) = false;
  end if;
  return new;
end;
$$;

drop trigger if exists solicitud_pasar_mandato_tg on public.ong_solicitudes;
create trigger solicitud_pasar_mandato_tg
  after update on public.ong_solicitudes
  for each row
  execute function public.solicitud_pasar_mandato();
