-- El legajo de admision entra por /sumate, no por un Google Form.
--
-- POR QUE
--
-- La asociacion tenia un Google Form («Legajo de Admision») que hacia cosas que
-- /sumate no hacia: cuatro consentimientos bien redactados, el diagnostico como
-- lista cerrada, y ramificacion segun tenga o no el carnet. Pero no escribia en
-- la base: alguien importaba a mano. De ahi salieron los dos padrones con los
-- mismos codigos apuntando a personas distintas, y las doce fichas que hubo que
-- limpiar en la asociación.
--
-- Esto trae lo bueno del formulario para adentro, para que haya UN circuito de
-- alta y no dos.
--
-- LAS TRES PREGUNTAS QUE EL FORMULARIO NO HACIA
--
--   1. `reprocann_vinculado` — ¿designaste a ESTA asociacion como tu cultivador?
--      Es LA pregunta, y no estaba. El 26/08/2026 las cuatro credenciales
--      cargadas en Chaco dicen «Paciente con autocultivo» y ninguna nombra a la
--      asociacion: las cuatro habrian contestado «SI» a «tenes REPROCANN?» y
--      las cuatro siguen sin habilitar a nadie. Tener credencial y haber
--      designado a la entidad son dos cosas distintas, y el sistema ya las
--      separa (pacientes.reprocann_estado vs ong_asociados.vinculado_reprocann).
--
--   2. `reprocann_nro` y `reprocann_vencimiento` — el formulario subia el PDF y
--      nada mas, asi que alguien tenia que abrir cada archivo y tipearlos. Con
--      el vencimiento cargado el sistema avisa solo cuando esta por caducar.
--
--   3. `dni_path` — la declaracion jurada del formulario dice «la documentacion
--      adjunta (DNI y REPROCANN, de corresponder)», pero NO habia ninguna
--      pregunta para subir el DNI. La persona juraba sobre un documento que
--      nunca entrego.
--
-- LA CANTIDAD VA PARTIDA EN NUMERO Y UNIDAD
--
-- En el Google Form era texto libre y produjo «10», «40gramos», «15 gramos» y
-- «200 gramos flores frescas». Sin unidad no se puede sumar ni comparar contra
-- un tope. Y sigue SIN ser un tope: es lo que la persona estima necesitar. El
-- tope lo fija la asociacion, en pacientes.tope_mensual_g, y se carga aparte.

alter table public.ong_solicitudes
  add column if not exists fecha_nacimiento    date,
  add column if not exists domicilio           text,
  add column if not exists localidad           text,
  add column if not exists provincia           text,
  add column if not exists patologia           text,
  add column if not exists formatos            text[],
  add column if not exists cantidad_mensual    numeric,
  add column if not exists cantidad_unidad     text,
  add column if not exists medico_tratante     text,
  add column if not exists matricula_medico    text,
  add column if not exists reprocann_tiene     boolean,
  add column if not exists reprocann_vinculado text,
  add column if not exists reprocann_vencimiento date,
  add column if not exists compromiso_regularizar boolean not null default false,
  add column if not exists dni_path            text,
  add column if not exists consentimientos_version text,
  add column if not exists consent_veracidad       boolean not null default false,
  add column if not exists consent_uso_personal    boolean not null default false,
  add column if not exists consent_responsabilidad boolean not null default false,
  add column if not exists consent_jurisdiccion    boolean not null default false;

do $mig$
begin
  if not exists (select 1 from pg_constraint where conname = 'ong_solicitudes_cantidad_unidad_chk') then
    alter table public.ong_solicitudes add constraint ong_solicitudes_cantidad_unidad_chk
      check (cantidad_unidad is null or cantidad_unidad in ('g','ml','u'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ong_solicitudes_repro_vinc_chk') then
    alter table public.ong_solicitudes add constraint ong_solicitudes_repro_vinc_chk
      check (reprocann_vinculado is null or reprocann_vinculado in ('si','no','no_se'));
  end if;
end $mig$;

comment on column public.ong_solicitudes.reprocann_vinculado is
  'Si la persona DECLARA haber designado a esta asociacion como su cultivador en REPROCANN. Es declarado, no verificado: lo confirma quien revisa mirando la credencial, y recien ahi se toca ong_asociados.vinculado_reprocann.';
comment on column public.ong_solicitudes.cantidad_mensual is
  'Lo que la persona ESTIMA necesitar por mes. NO es un tope: el tope lo fija la asociacion en pacientes.tope_mensual_g.';
comment on column public.ong_solicitudes.dni_path is
  'PATH en el bucket documentos, NO una URL. Lo sube la Edge Function solicitud-adjunto.';

-- ---------------------------------------------------------------------------
-- solicitud_crear recibe el legajo como UN jsonb
-- ---------------------------------------------------------------------------
--
-- Un parametro por campo serian veinte argumentos posicionales, y agregar uno
-- mas obligaria a dropear y recrear la funcion cada vez —con el riesgo de
-- perder los grants, que ya mordio el 26/08—. Con jsonb la firma no se mueve.
--
-- Lo que no viene, no se inventa: cada campo se lee con ->> y queda null.
create or replace function public.solicitud_crear(
  p_nombre   text,
  p_dni      text,
  p_email    text default null,
  p_telefono text default null,
  p_notas    text default null,
  p_mandato_aceptado boolean default false,
  p_mandato_version  text default null,
  p_legajo   jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_nombre text;
  v_dni    text;
  v_token  text;
  v_ultima timestamptz;
  v_l      jsonb := coalesce(p_legajo, '{}'::jsonb);
  v_cant   numeric;
  v_uni    text;
  v_vinc   text;
begin
  v_nombre := btrim(coalesce(p_nombre, ''));
  v_dni    := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');

  if length(v_nombre) < 3 then
    raise exception 'Falta el nombre y apellido';
  end if;
  if length(v_dni) < 7 or length(v_dni) > 9 then
    raise exception 'El documento no parece valido';
  end if;

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

  if (select count(*) from ong_solicitudes
       where creada_en > now() - interval '1 hour') >= 40 then
    raise exception 'Hay demasiadas solicitudes en curso. Proba de nuevo en un rato.';
  end if;

  -- La cantidad: si no es un numero, no entra. Un texto en una columna numerica
  -- explota el insert entero, y el formulario viejo mandaba cosas como «10» y
  -- «200 gramos flores frescas» en el mismo campo.
  begin
    v_cant := nullif(btrim(coalesce(v_l->>'cantidad_mensual','')), '')::numeric;
  exception when others then
    v_cant := null;
  end;
  if v_cant is not null and (v_cant <= 0 or v_cant > 100000) then
    v_cant := null;
  end if;

  v_uni := nullif(btrim(coalesce(v_l->>'cantidad_unidad','')), '');
  if v_uni is not null and v_uni not in ('g','ml','u') then v_uni := null; end if;

  v_vinc := nullif(btrim(coalesce(v_l->>'reprocann_vinculado','')), '');
  if v_vinc is not null and v_vinc not in ('si','no','no_se') then v_vinc := null; end if;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into ong_solicitudes (
    token, nombre, dni, email, telefono, notas, estado,
    mandato_aceptado, mandato_version, mandato_fecha,
    fecha_nacimiento, domicilio, localidad, provincia,
    patologia, formatos, cantidad_mensual, cantidad_unidad,
    medico_tratante, matricula_medico,
    reprocann_tiene, reprocann_nro, reprocann_vinculado, reprocann_vencimiento,
    compromiso_regularizar, consentimientos_version,
    consent_veracidad, consent_uso_personal, consent_responsabilidad, consent_jurisdiccion
  ) values (
    v_token, v_nombre, v_dni,
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_telefono, '')), ''),
    nullif(btrim(coalesce(p_notas, '')), ''),
    'pendiente',
    coalesce(p_mandato_aceptado, false),
    nullif(btrim(coalesce(p_mandato_version, '')), ''),
    case when coalesce(p_mandato_aceptado, false) then now() else null end,
    -- Una fecha mal escrita no puede voltear el alta entera.
    (select case when (v_l->>'fecha_nacimiento') ~ '^\d{4}-\d{2}-\d{2}$'
                 then (v_l->>'fecha_nacimiento')::date end),
    nullif(btrim(coalesce(v_l->>'domicilio','')), ''),
    nullif(btrim(coalesce(v_l->>'localidad','')), ''),
    nullif(btrim(coalesce(v_l->>'provincia','')), ''),
    nullif(btrim(coalesce(v_l->>'patologia','')), ''),
    case when jsonb_typeof(v_l->'formatos') = 'array'
         then array(select jsonb_array_elements_text(v_l->'formatos')) end,
    v_cant, v_uni,
    nullif(btrim(coalesce(v_l->>'medico_tratante','')), ''),
    nullif(btrim(coalesce(v_l->>'matricula_medico','')), ''),
    (v_l->>'reprocann_tiene')::boolean,
    -- El numero pasa el mismo filtro que el importador: una tirada de 4+
    -- digitos. Sin esto vuelve a entrar la respuesta de un desplegable.
    (select case when (v_l->>'reprocann_nro') ~ '[0-9]{4,}'
                 then btrim(v_l->>'reprocann_nro') end),
    v_vinc,
    (select case when (v_l->>'reprocann_vencimiento') ~ '^\d{4}-\d{2}-\d{2}$'
                 then (v_l->>'reprocann_vencimiento')::date end),
    coalesce((v_l->>'compromiso_regularizar')::boolean, false),
    nullif(btrim(coalesce(v_l->>'consentimientos_version','')), ''),
    coalesce((v_l->>'consent_veracidad')::boolean, false),
    coalesce((v_l->>'consent_uso_personal')::boolean, false),
    coalesce((v_l->>'consent_responsabilidad')::boolean, false),
    coalesce((v_l->>'consent_jurisdiccion')::boolean, false)
  );

  return v_token;
end;
$fn$;

revoke all on function public.solicitud_crear(text,text,text,text,text,boolean,text,jsonb) from public;
grant execute on function public.solicitud_crear(text,text,text,text,text,boolean,text,jsonb) to anon, authenticated;

-- La de 7 parametros se va: con las dos vivas, una llamada sin el jsonb queda
-- ambigua —el nuevo tiene default— y la base responde «function is not unique».
drop function if exists public.solicitud_crear(text,text,text,text,text,boolean,text);
