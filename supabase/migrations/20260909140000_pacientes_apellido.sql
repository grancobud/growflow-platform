-- EL APELLIDO PRIMERO, EN TODOS LADOS. Y para eso hay que SABER cual es.
--
-- `nombre_completo` es un solo campo de texto libre cargado con dos criterios
-- distintos: hay «Juan Pablo Donnet» (nombre primero) y hay «Aguirre Walter
-- Ariel» (apellido primero). Con eso no se puede ordenar por apellido: tomar la
-- ultima palabra pondria a «Aguirre Walter Ariel» en la A de Ariel.
--
-- NO SE TOCA `nombre_completo`. Sigue siendo lo que alguien escribio, y es lo
-- que se compara contra el REPROCANN y contra la planilla. Estas columnas son
-- la LECTURA de ese texto, no su reemplazo.
alter table public.pacientes
  add column if not exists apellido text,
  add column if not exists nombres text,
  -- El backfill ADIVINA. Esta marca separa «alguien lo confirmo» de «lo dedujo
  -- el sistema», y es lo unico que evita que el orden por apellido se lea como
  -- un dato verificado cuando no lo es.
  add column if not exists apellido_confirmado boolean not null default false;

comment on column public.pacientes.apellido is
  'El apellido, para mostrar y ordenar. Deducido de nombre_completo si apellido_confirmado es false.';
comment on column public.pacientes.nombres is
  'El resto del nombre. nombre_completo NO se toca: es lo que se compara contra el REPROCANN.';
comment on column public.pacientes.apellido_confirmado is
  'true = lo reviso una persona. false = lo dedujo el sistema y puede estar mal.';

-- Cosmetico y seguro: espacios de mas, y nombres escritos todo en minuscula.
update public.pacientes set nombre_completo = regexp_replace(trim(nombre_completo), '\s+', ' ', 'g')
 where nombre_completo <> regexp_replace(trim(nombre_completo), '\s+', ' ', 'g');
update public.pacientes set nombre_completo = initcap(nombre_completo)
 where activo and nombre_completo = lower(nombre_completo);

-- BACKFILL PROPUESTO: la ULTIMA palabra como apellido. Es la convencion del
-- formulario («Nombre y Apellido») y acierta en la mayoria, pero se equivoca en
-- los que estan al reves. Queda sin confirmar a proposito.
update public.pacientes
   set apellido = (regexp_split_to_array(trim(nombre_completo), ' '))[
         array_length(regexp_split_to_array(trim(nombre_completo), ' '), 1)],
       nombres = nullif(trim(regexp_replace(trim(nombre_completo), '\s+\S+$', '')), '')
 where not apellido_confirmado and coalesce(trim(nombre_completo), '') <> '';

create index if not exists pacientes_apellido_idx on public.pacientes (apellido);

-- La app lee la vista, no la tabla: una columna nueva no llega sola. Van al
-- FINAL porque create or replace view renombra por posicion.
create or replace view public.pacientes_segun_rol as
 SELECT id, nombre_completo, dni, fecha_nacimiento, telefono, email, localidad,
    provincia, domicilio, foto_url, reprocann_nro, reprocann_estado,
    reprocann_emision, reprocann_vencimiento, modalidad, socio, fecha_alta,
    activo, notas, creado_en, plantas_habilitadas, m2_habilitados,
    tope_mensual_g, nivel_tarifa, codigo,
        CASE WHEN puede_ver_clinico() THEN patologia ELSE NULL::text END AS patologia,
        CASE WHEN puede_ver_clinico() THEN medico_tratante ELSE NULL::text END AS medico_tratante,
        CASE WHEN puede_ver_clinico() THEN matricula_medico ELSE NULL::text END AS matricula_medico,
        CASE WHEN puede_ver_clinico() THEN credencial_url ELSE NULL::text END AS credencial_url,
        CASE WHEN puede_ver_plata() THEN aporte_acordado_g ELSE NULL::numeric END AS aporte_acordado_g,
        CASE WHEN puede_ver_plata() THEN notas_economicas ELSE NULL::text END AS notas_economicas,
    codigo_vinculacion, retira_como_retribucion,
    apellido, nombres, apellido_confirmado
   FROM pacientes
  WHERE puede_ver_padron();

revoke all on public.pacientes_segun_rol from anon;
grant select on public.pacientes_segun_rol to authenticated;
