-- El acuerdo de aporte vivia en `notas`, que la ve todo el que ve el padron.
--
-- 31/08/2026. Salio de revisar el punto que habia quedado abierto: «notas es
-- texto libre y puede tener dato clinico adentro». Medido sobre las 198 notas
-- con contenido, ese riesgo NO existe hoy:
--
--   con palabra clinica (patolog|diagn|dolor|epilep|...)   0 de 198
--   con importe en pesos                                   2
--   letras sueltas (V, N, R, O, X)                       117
--   resto: bitacora de auditoria de datos (DESVINCULADO, FICHA DUPLICADA,
--          DNI corregido, REPROCANN limpiado, TELEFONO COMPARTIDO)
--
-- El problema era el CONTRARIO del que se busco. Dos notas tenian el historial
-- economico completo de los dos socios de mayor volumen:
--
--   PAC-XXX  «Aporta $X.XXX por gramo ... X.XXX g, $X.XXX.XXX aportados ...
--             $X.XXX.XXX que la asociacion absorbio»
--   PAC-XXX  «Aporta $X.XXX por gramo ... 131 g, $XXX.XXX aportados»
--
-- Al director medico se le habia cerrado la caja, los comprobantes y el aporte
-- de las 1.248 entregas horas antes, y esto le entraba igual por un campo de
-- texto. Una restriccion que se saltea por el costado no es una restriccion.
--
-- ---------------------------------------------------------------------------
-- POR QUE DOS COLUMNAS Y NO UNA
--
-- `aporte_acordado_g` sola no alcanzaba. Esas notas no son «una cifra suelta»:
-- son el analisis que dice cuanto absorbio la asociacion y que FALTA la
-- ratificacion del organo directivo. Sacarles los numeros para que entren en
-- `notas` mutila un analisis que alguien va a necesitar. Y dejarlas donde
-- estaban era el problema.
--
-- Asi que el numero va estructurado y el texto va a un campo que es plata. En
-- `notas` queda una linea que dice que el acuerdo existe y donde mirarlo: quien
-- no ve plata tiene que poder saber que hay un acuerdo, sin ver de cuanto.
--
-- LA CAUSA RAIZ ERA QUE NO HABIA DONDE PONERLO. Por eso no alcanzaba con
-- reescribir las dos notas: sin un lugar, el proximo acuerdo vuelve al mismo
-- campo de texto. El cruce `nota_con_importe` en Coherencia avisa si pasa.

alter table public.pacientes
  add column if not exists aporte_acordado_g numeric,
  add column if not exists notas_economicas  text;

comment on column public.pacientes.aporte_acordado_g is
  'Aporte pactado por gramo cuando nivel_tarifa = acuerdo. Nullable: null es «no hay acuerdo», no cero.';
comment on column public.pacientes.notas_economicas is
  'El analisis del acuerdo. Va aparte de notas porque notas la ve todo el que ve el padron y esto es plata.';

create or replace view public.pacientes_segun_rol as
select
  id, nombre_completo, dni, fecha_nacimiento, telefono, email,
  localidad, provincia, domicilio, foto_url,
  reprocann_nro, reprocann_estado, reprocann_emision, reprocann_vencimiento,
  modalidad,
  socio, fecha_alta, activo, notas, creado_en,
  plantas_habilitadas, m2_habilitados, tope_mensual_g, nivel_tarifa, codigo,
  case when public.puede_ver_clinico() then patologia         end as patologia,
  case when public.puede_ver_clinico() then medico_tratante   end as medico_tratante,
  case when public.puede_ver_clinico() then matricula_medico  end as matricula_medico,
  case when public.puede_ver_clinico() then credencial_url    end as credencial_url,
  case when public.puede_ver_plata()   then aporte_acordado_g end as aporte_acordado_g,
  case when public.puede_ver_plata()   then notas_economicas  end as notas_economicas
from public.pacientes
where public.puede_ver_padron();

revoke all on public.pacientes_segun_rol from anon;
grant select on public.pacientes_segun_rol to authenticated;

-- El trigger pasa a cubrir las DOS naturalezas, y por eso cambia de nombre:
-- `preservar_lo_clinico` ya no decia la verdad. La guarda de `auth.uid()` sube
-- al principio, que es lo mismo pero se lee de una.
create or replace function public.preservar_lo_que_no_puede_ver()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then return new; end if;
  if not public.puede_ver_clinico() then
    new.patologia        := old.patologia;
    new.medico_tratante  := old.medico_tratante;
    new.matricula_medico := old.matricula_medico;
    new.credencial_url   := old.credencial_url;
  end if;
  if not public.puede_ver_plata() then
    new.aporte_acordado_g := old.aporte_acordado_g;
    new.notas_economicas  := old.notas_economicas;
  end if;
  return new;
end $$;

drop trigger if exists preservar_lo_clinico on public.pacientes;
drop function if exists public.preservar_lo_clinico();
create trigger preservar_lo_que_no_puede_ver
  before update on public.pacientes
  for each row execute function public.preservar_lo_que_no_puede_ver();

-- Las dos filas. El texto NO se pierde: `notas` entera se copia a
-- `notas_economicas` y recien despues se reemplaza. Reversible con
-- REVERTIR-acuerdos-de-aporte-2026-08-31.sql, que lleva el texto original.
update public.pacientes set
  aporte_acordado_g = 3971,
  notas_economicas  = notas,
  notas = 'ACUERDO DE APORTE ESPECIAL registrado el 24/08/2026 (nivel_tarifa = acuerdo). El detalle economico esta en el legajo economico.'
where id = '86e65c26-e7b2-4739-9ba9-5c7a2c6696de' and notas_economicas is null;

update public.pacientes set
  aporte_acordado_g = 5885,
  notas_economicas  = notas,
  notas = 'ACUERDO DE APORTE ESPECIAL registrado el 24/08/2026 (nivel_tarifa = acuerdo). El detalle economico esta en el legajo economico.'
where id = '17b62e02-2715-4481-8975-cdbeffb49fbd' and notas_economicas is null;
