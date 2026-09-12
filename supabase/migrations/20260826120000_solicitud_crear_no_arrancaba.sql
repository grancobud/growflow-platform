-- solicitud_crear no funcionaba. Nunca. Desde el 23/08/2026.
--
-- Los 0 registros de ong_solicitudes no eran falta de uso: era que NADIE PODIA.
-- Cualquiera que completara /sumate recibia un error y se iba. Se descubrio el
-- 26/08/2026, al revisar el circuito antes de mandarle el link a los 211 socios.
--
-- Eran DOS bugs en fila, y el segundo solo se ve despues de arreglar el primero.
--
-- BUG 1 — la funcion se caia en la linea del token.
--
-- La migracion del mandato (20260823210000) reescribio solicitud_crear y cambio
-- la generacion del token a `encode(gen_random_bytes(24), 'hex')`. Pero
-- gen_random_bytes es de pgcrypto, y en Supabase pgcrypto vive en el schema
-- `extensions`, no en `public`. La funcion declara `set search_path = public`,
-- asi que el nombre no resuelve:
--
--     ERROR: function gen_random_bytes(integer) does not exist
--
-- La migracion ORIGINAL usaba dos gen_random_uuid() pegados y lo decia en un
-- comentario —«sin depender de pgcrypto»—. Ese comentario era la advertencia
-- exacta de lo que despues paso, y se perdio junto con el codigo.
--
-- BUG 2 — el token tenia el largo equivocado.
--
-- gen_random_bytes(24) en hex son 48 caracteres. Pero solicitud_estado exige
-- `length(p_token) = 64` —el largo de los dos uuid— y devuelve CERO filas si no
-- da. O sea que, aun arreglando el bug 1, cada persona se llevaba un link que
-- no abria nada, para siempre y sin mensaje de error.
--
-- Volver a los dos uuid arregla los dos bugs de una, y sin tocar
-- solicitud_estado: 64 caracteres es lo que esa funcion siempre espero.
--
-- DE PASO, LO QUE LA MIGRACION DEL MANDATO SE HABIA COMIDO
--
-- Al reescribir la funcion entera para sumarle dos parametros, se perdio todo
-- lo que el cuerpo original tenia y que no estaba relacionado con el mandato:
--
--   · La normalizacion del DNI a digitos. «12.345.678» y «12345678» son el
--     mismo documento; guardar las dos formas rompe el chequeo de duplicados.
--   · La validacion de largo del documento (7 a 9 digitos).
--   · El freno de «la misma persona dentro de 24 h», que es sobre todo contra
--     el doble clic y contra quien reenvia porque no supo si llego.
--   · El techo de 40 solicitudes por hora.
--
-- Los dos frenos importan justo ahora: la campana que viene le manda el link a
-- 211 personas de golpe, y no hay captcha.
--
-- Se conserva TODO lo que la migracion del mandato agrego: los dos parametros,
-- la firma con su version, y la fecha puesta por la base.

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
  v_nombre text;
  v_dni    text;
  v_token  text;
  v_ultima timestamptz;
begin
  v_nombre := btrim(coalesce(p_nombre, ''));
  v_dni    := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');

  if length(v_nombre) < 3 then
    raise exception 'Falta el nombre y apellido';
  end if;
  if length(v_dni) < 7 or length(v_dni) > 9 then
    raise exception 'El documento no parece valido';
  end if;

  -- Freno 1: la misma persona, de nuevo.
  select creada_en into v_ultima
    from ong_solicitudes
   where dni = v_dni
     and estado in ('pendiente', 'en_revision')
     and creada_en > now() - interval '24 hours'
   limit 1;
  if found then
    raise exception 'Ya hay una solicitud en curso con ese documento, del %. Usa el link que te dimos para ver como va.',
      to_char(v_ultima, 'DD/MM/YYYY');
  end if;

  -- Freno 2: el techo por hora. No frena al abuso decidido —para eso hace falta
  -- un captcha— pero acota cuanto puede crecer la bandeja en un rato.
  if (select count(*) from ong_solicitudes
       where creada_en > now() - interval '1 hour') >= 40 then
    raise exception 'Hay demasiadas solicitudes en curso. Proba de nuevo en un rato.';
  end if;

  -- Dos uuid v4 pegados: 244 bits de azar, SIN depender de pgcrypto y con los
  -- 64 caracteres que solicitud_estado valida. No cambiar esto por
  -- gen_random_bytes: rompe las dos cosas a la vez. Ver el encabezado.
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into public.ong_solicitudes
    (token, nombre, dni, email, telefono, notas, estado,
     mandato_aceptado, mandato_version, mandato_fecha)
  values
    (v_token, v_nombre, v_dni,
     nullif(btrim(coalesce(p_email, '')), ''),
     nullif(btrim(coalesce(p_telefono, '')), ''),
     nullif(btrim(coalesce(p_notas, '')), ''),
     'pendiente',
     coalesce(p_mandato_aceptado, false),
     nullif(btrim(coalesce(p_mandato_version, '')), ''),
     -- La fecha la pone la base: una fecha de firma que manda quien firma no
     -- prueba nada.
     case when coalesce(p_mandato_aceptado, false) then now() else null end);

  return v_token;
end;
$$;

revoke all on function public.solicitud_crear(text, text, text, text, text, boolean, text) from public;
grant execute on function public.solicitud_crear(text, text, text, text, text, boolean, text) to anon, authenticated;
