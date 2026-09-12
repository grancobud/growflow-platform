-- Solicitudes de alta: la puerta publica para sumarse a la asociacion.
--
-- EL PROBLEMA
--
-- Hoy /sumate muestra tres links y nada mas. Quien los completa queda sin saber
-- si su formulario llego, si lo dieron de alta, o si tiene que esperar. Vuelve a
-- entrar y ve exactamente lo mismo. Del otro lado, quien atiende tipea la ficha
-- a mano desde lo que le llego por otro canal.
--
-- LA FORMA, Y POR QUE ES ASI
--
-- Esta es la UNICA escritura publica de todo el sistema, contra una base con
-- 211 pacientes reales y datos de salud. El diseño arranca de ahi:
--
--   1. `anon` NO tiene acceso a la tabla. Ni select, ni insert, ni nada. Se
--      revoca explicito ademas de no darle policy, porque una policy que
--      alguien agregue despues por comodidad abriria la tabla entera.
--
--   2. La unica puerta son dos funciones `security definer` de superficie
--      minima: una crea, la otra devuelve el estado de UNA solicitud a quien
--      tenga su token. Nada mas.
--
--   3. `solicitud_estado` NO devuelve el DNI. Si el link se reenvia o queda en
--      un historial compartido, lo que se expone es un nombre y un estado, no
--      un documento.
--
--   4. NO existe «busca mi solicitud por DNI». Seria un buscador publico que
--      confirma quien es paciente de cannabis de la asociacion: con probar
--      documentos se arma el padron. El token se entrega UNA vez, en el momento
--      de crear la solicitud, a quien la crea.
--
-- Lo que NO defiende: alguien puede crear solicitudes basura con documentos
-- inventados. Sin captcha ni edge function no hay forma de distinguirlas. Se
-- acotan con los dos frenos de abajo; lo que queda es ruido en una bandeja, no
-- una fuga.

create table if not exists public.ong_solicitudes (
  id              uuid primary key default gen_random_uuid(),
  -- El secreto. Va indexado y unico: es por donde entra la persona.
  token           text not null unique,
  nombre          text not null,
  dni             text not null,
  email           text,
  telefono        text,
  notas           text,
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'en_revision', 'aceptada', 'rechazada')),
  -- Por que se rechazo, para poder decirselo a la persona en su propia pantalla.
  motivo          text,
  -- Con que ficha quedo resuelta, cuando se acepta.
  paciente_id     uuid references public.pacientes(id) on delete set null,
  asociado_id     uuid references public.ong_asociados(id) on delete set null,
  creada_en       timestamptz not null default now(),
  actualizada_en  timestamptz not null default now(),
  revisada_por    uuid references auth.users(id) on delete set null
);

comment on table public.ong_solicitudes is
  'Solicitudes de alta que entran por /sumate. Unica escritura publica del sistema: anon solo llega por solicitud_crear() y solicitud_estado().';

create index if not exists ong_solicitudes_estado_idx
  on public.ong_solicitudes (estado, creada_en desc);
create index if not exists ong_solicitudes_dni_idx
  on public.ong_solicitudes (dni);

alter table public.ong_solicitudes enable row level security;

-- Del lado de adentro, los mismos roles que el resto de la O.N.G.
drop policy if exists ong_solicitudes_ver on public.ong_solicitudes;
create policy ong_solicitudes_ver on public.ong_solicitudes
  for select to authenticated
  using (mi_rol() = any (array['administrador', 'director_medico', 'administrativo', 'auditor']));

drop policy if exists ong_solicitudes_escribir on public.ong_solicitudes;
create policy ong_solicitudes_escribir on public.ong_solicitudes
  for all to authenticated
  using (mi_rol() = any (array['administrador', 'director_medico', 'administrativo']))
  with check (mi_rol() = any (array['administrador', 'director_medico', 'administrativo']));

-- Explicito, no por omision. Ver el punto 1 del encabezado.
revoke all on public.ong_solicitudes from anon;

-- ---------------------------------------------------------------------------
-- Crear una solicitud. Devuelve el token, UNA sola vez.
-- ---------------------------------------------------------------------------
create or replace function public.solicitud_crear(
  p_nombre   text,
  p_dni      text,
  p_email    text default null,
  p_telefono text default null,
  p_notas    text default null
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
  -- Solo digitos: «12.345.678» y «12345678» son el mismo documento, y guardar
  -- las dos formas rompe el chequeo de duplicados de abajo.
  v_dni := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');

  if length(v_nombre) < 3 then
    raise exception 'Falta el nombre y apellido';
  end if;
  if length(v_dni) < 7 or length(v_dni) > 9 then
    raise exception 'El documento no parece valido';
  end if;

  -- Freno 1: la misma persona, de nuevo. Es sobre todo contra el doble clic y
  -- contra quien reenvia el formulario porque no supo si llego.
  select creada_en into v_ultima
    from ong_solicitudes
   where dni = v_dni
     and estado in ('pendiente', 'en_revision')
     and creada_en > now() - interval '24 hours'
   limit 1;
  if found then
    raise exception 'Ya hay una solicitud en curso con ese documento, del %. Usá el link que te dimos para ver como va.',
      to_char(v_ultima, 'DD/MM/YYYY');
  end if;

  -- Freno 2: el techo por hora. No impide el abuso decidido —para eso hace
  -- falta un captcha— pero acota cuanto puede crecer la bandeja en un rato.
  if (select count(*) from ong_solicitudes
       where creada_en > now() - interval '1 hour') >= 40 then
    raise exception 'Hay demasiadas solicitudes en curso. Probá de nuevo en un rato.';
  end if;

  -- Dos uuid v4 pegados: 244 bits de azar, sin depender de pgcrypto. Adivinar
  -- un token no es una via de entrada.
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into ong_solicitudes (token, nombre, dni, email, telefono, notas)
  values (
    v_token, v_nombre, v_dni,
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_telefono, '')), ''),
    nullif(btrim(coalesce(p_notas, '')), '')
  );

  return v_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- Como va MI solicitud. Solo para quien tenga el token.
-- ---------------------------------------------------------------------------
--
-- Devuelve tambien el codigo de vinculacion de la entidad, que es el dato que
-- la persona necesita para designarla en REPROCANN: es el paso donde se traba
-- el alta, y hasta ahora se lo pasaban por WhatsApp de memoria. No es un
-- secreto — es un numero que la asociacion reparte a proposito.
--
-- Sin token valido devuelve CERO filas. No dice «no existe»: dice nada.
create or replace function public.solicitud_estado(p_token text)
returns table (
  estado             text,
  nombre             text,
  creada_en          timestamptz,
  actualizada_en     timestamptz,
  motivo             text,
  entidad            text,
  codigo_vinculacion text
)
language sql
security definer
set search_path = public
stable
as $$
  select s.estado, s.nombre, s.creada_en, s.actualizada_en, s.motivo,
         e.razon_social, e.codigo_vinculacion
    from ong_solicitudes s
    left join lateral (
      select razon_social, codigo_vinculacion from ong_entidad limit 1
    ) e on true
   where s.token = p_token
     -- Un token vacio o de largo raro no puede pescar la primera fila.
     and length(coalesce(p_token, '')) = 64;
$$;

revoke all on function public.solicitud_crear(text, text, text, text, text) from public;
grant execute on function public.solicitud_crear(text, text, text, text, text) to anon, authenticated;

revoke all on function public.solicitud_estado(text) from public;
grant execute on function public.solicitud_estado(text) to anon, authenticated;
