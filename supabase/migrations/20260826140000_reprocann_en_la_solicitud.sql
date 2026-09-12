-- La persona adjunta su REPROCANN desde su propio link.
--
-- POR QUE EN LA PANTALLA DEL TOKEN Y NO EN EL FORMULARIO
--
-- Quien recien se suma TODAVIA NO TIENE REPROCANN: sacarlo es el paso 2 del
-- circuito. Pedirle la constancia en el formulario inicial es pedirsela justo
-- en el unico momento en que seguro no la tiene.
--
-- La pantalla del token, en cambio, hoy le dice «vinacula tu REPROCANN» y no le
-- da donde. Es el lugar natural: la persona vuelve cuando ya lo tramito.
--
-- QUE SE LE PIDE, Y QUE NO
--
-- El NUMERO y el ARCHIVO. NO se le pide que elija el estado —vigente, vencido,
-- en tramite—, y es a proposito: el 25/08/2026 hubo que limpiar 12 fichas
-- porque el formulario anterior guardo la ETIQUETA de esa pregunta
-- («Tengo REPROCANN VIGENTE / VENCIDO/ PENDIENTE») dentro del campo del numero,
-- y eso las dejo en estado «En tramite» — el estado con el que se puede
-- dispensar sin marcar la entrega como sin respaldo. Gente que declaro NO tener
-- REPROCANN quedo habilitada a retirar.
--
-- El estado lo pone quien revisa, mirando el archivo. Un desplegable menos es
-- una via menos de que vuelva a pasar.
--
-- EL ARCHIVO NO PASA POR ACA
--
-- Lo sube la Edge Function `solicitud-adjunto`, que valida el token y escribe
-- con service role. `anon` sigue sin un solo permiso sobre esta tabla y sin
-- permiso de escritura en el bucket: darle INSERT sobre `documentos` seria
-- abrir escritura publica en un bucket que ya guarda credenciales reales.
-- Aca solo queda el PATH, como en el resto del sistema; nunca una URL publica.

alter table public.ong_solicitudes
  add column if not exists reprocann_nro       text,
  add column if not exists reprocann_path      text,
  add column if not exists reprocann_subido_en timestamptz;

comment on column public.ong_solicitudes.reprocann_nro is
  'Numero de credencial que declaro la persona. Validado como 4+ digitos antes de guardarse (ver lib/datosDelFormulario.ts): el campo libre ya se lleno una vez con la etiqueta de la pregunta.';
comment on column public.ong_solicitudes.reprocann_path is
  'PATH dentro del bucket `documentos`, NO una URL. Se lee con createSignedUrl, igual que las credenciales de pacientes.';

-- ---------------------------------------------------------------------------
-- solicitud_estado avisa si ya adjunto, para no pedirselo dos veces
-- ---------------------------------------------------------------------------
--
-- Devuelve un BOOLEANO, no el path. El path es interno: con el token no se
-- llega a ningun archivo, solo se sabe que ya se subio uno. Se mantiene todo lo
-- demas como estaba, el DNI incluido: sigue sin devolverse.
--
-- ⚠ El `length(p_token) = 64` de abajo NO es decorativo y NO se toca sin mirar
-- solicitud_crear: el 26/08/2026 se descubrio que la funcion generaba tokens de
-- 48 caracteres contra este 64, asi que ningun link abria nada. Los dos numeros
-- tienen que seguir siendo el mismo.
drop function if exists public.solicitud_estado(text);

create or replace function public.solicitud_estado(p_token text)
returns table (
  estado             text,
  nombre             text,
  creada_en          timestamptz,
  actualizada_en     timestamptz,
  motivo             text,
  entidad            text,
  codigo_vinculacion text,
  reprocann_cargado  boolean,
  reprocann_nro      text
)
language sql
security definer
set search_path = public
stable
as $$
  select s.estado, s.nombre, s.creada_en, s.actualizada_en, s.motivo,
         e.razon_social, e.codigo_vinculacion,
         (s.reprocann_path is not null) as reprocann_cargado,
         s.reprocann_nro
    from ong_solicitudes s
    left join lateral (
      select razon_social, codigo_vinculacion from ong_entidad limit 1
    ) e on true
   where s.token = p_token
     and length(coalesce(p_token, '')) = 64;
$$;

revoke all on function public.solicitud_estado(text) from public;
grant execute on function public.solicitud_estado(text) to anon, authenticated;
