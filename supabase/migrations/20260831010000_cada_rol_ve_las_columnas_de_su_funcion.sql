-- El dato sensible y el importe salen de la fila, no de la tabla.
--
-- 31/08/2026. Sale de preguntarse que dice la NORMA que tiene que ver cada uno,
-- en vez de a quien le tenemos confianza.
--
-- EL MARCO. Ley 25.326 art. 2: los datos de salud son datos SENSIBLES. Art. 4:
-- tienen que ser pertinentes y NO EXCESIVOS respecto de la finalidad. Art. 8:
-- los profesionales de la salud pueden tratarlos respetando el secreto
-- profesional. Ley 26.529: la historia clinica es del paciente y su acceso es
-- restringido. Codigo Penal 156: violacion de secreto profesional. Y la Ley
-- 27.350 con el Decreto 883/2020 y la Res. 800/2021 son las que ponen un medico
-- a INDICAR y a hacer el SEGUIMIENTO, que es de donde sale que necesita.
--
-- El criterio que sale de ahi es MINIMIZACION: cada rol ve lo que su funcion
-- necesita. Para cobrar una cuota no hace falta el diagnostico; para hacer
-- seguimiento clinico no hace falta cuanto se cobro.
--
-- EL PROBLEMA TECNICO ES QUE `pacientes` MEZCLA TRES NATURALEZAS EN UNA TABLA:
--   · sensible      patologia, medico_tratante, matricula_medico, credencial_url
--   · habilitacion  reprocann_*, modalidad, tope_mensual_g, plantas_habilitadas
--   · administrativo nombre, dni, contacto, domicilio, codigo, nivel_tarifa
-- y el RLS de Postgres NO SABE DE COLUMNAS: decide filas enteras. Es el mismo
-- problema que ya resolvio `lotes_stock` para el stock sin el precio.
--
-- SE HACE AHORA PORQUE ESTA VACIO. Medido hoy: patologia 0 de 223,
-- medico_tratante 0, matricula_medico 0, credencial_url 0. Cerrar un campo
-- despues de cargarlo es avisar tarde; el momento es antes.
--
-- ---------------------------------------------------------------------------
-- POR QUE UNA SOLA VISTA Y NO UNA POR ROL
--
-- Una vista por rol obliga al front a elegir la fuente, y elegir mal se ve como
-- una pantalla vacia, que se lee como rota. Con una sola vista que ANULA la
-- columna segun quien pregunta, el front lee siempre lo mismo y la decision
-- vive en un solo lugar: aca.
--
-- Las vistas van SECURITY DEFINER (el default de Postgres), igual que
-- `pacientes_min` y por la misma razon: su barrera es el WHERE de adentro, no
-- el RLS de la tabla de abajo. Ponerles `security_invoker` las dejaria en cero
-- filas para todos los roles que la vista existe para atender.

create or replace view public.pacientes_segun_rol as
select
  id, nombre_completo, dni, fecha_nacimiento, telefono, email,
  localidad, provincia, domicilio, foto_url,
  reprocann_nro, reprocann_estado, reprocann_emision, reprocann_vencimiento,
  modalidad,
  socio, fecha_alta, activo, notas, creado_en,
  plantas_habilitadas, m2_habilitados, tope_mensual_g, nivel_tarifa, codigo,
  -- Las cuatro sensibles. Quien no atiende pacientes las recibe en NULL.
  case when public.puede_ver_clinico() then patologia         end as patologia,
  case when public.puede_ver_clinico() then medico_tratante   end as medico_tratante,
  case when public.puede_ver_clinico() then matricula_medico  end as matricula_medico,
  case when public.puede_ver_clinico() then credencial_url    end as credencial_url
from public.pacientes
where public.puede_ver_padron();

-- OJO CON `notas`: es texto libre y por eso puede tener adentro cualquier cosa,
-- dato de salud incluido —en Chaco se escribio ahi que alguien es cultivador
-- registrado, porque no habia columna—. Queda VISIBLE a proposito: es donde se
-- anota lo operativo y anularlo romperia el trabajo administrativo. Es un
-- riesgo conocido y la respuesta correcta no es esconderlo sino que lo clinico
-- tenga su campo.

create or replace view public.dispensas_segun_rol as
select
  id, user_id, paciente_id, fecha, producto, genetica_id, gramos, unidad,
  modalidad, entregado_por, con_receta, notas, creado_en,
  recibo_numero, lote_codigo,
  -- Los cuatro importes. Quien no ve plata recibe la entrega sin el dinero:
  -- fecha, gramos, producto, genetica y lote, que es la trazabilidad de la
  -- indicacion medica, sin cuanto se cobro.
  case when public.puede_ver_plata() then aporte          end as aporte,
  case when public.puede_ver_plata() then medio_pago      end as medio_pago,
  case when public.puede_ver_plata() then pago_referencia end as pago_referencia,
  case when public.puede_ver_plata() then aporte_desglose end as aporte_desglose
from public.ong_dispensas
where public.mi_rol() = any (array[
  'administrador','administrador_sistema','director_medico','administrativo','auditor']);

revoke all on public.pacientes_segun_rol from anon;
revoke all on public.dispensas_segun_rol from anon;
grant select on public.pacientes_segun_rol to authenticated;
grant select on public.dispensas_segun_rol to authenticated;

-- ---------------------------------------------------------------------------
-- Y AHORA LO QUE UNA VISTA SOLA NO TAPA: EL PISADO CON NULL
--
-- Si el administrativo abre una ficha, la columna `patologia` le llega NULL, y
-- al guardar el formulario manda el objeto entero: el UPDATE escribe NULL sobre
-- la patologia REAL. Es un borrado silencioso de dato clinico causado por una
-- medida de privacidad, que es la peor forma de fallar —nadie lo relaciona—.
--
-- No se arregla en el front. Un formulario que se porta bien hoy es un
-- formulario que alguien toca manana. Se arregla en la base: si quien escribe
-- no puede ver la columna, no la puede cambiar. La fila vieja gana.
--
-- LA GUARDA DE `auth.uid()` NO ES DECORATIVA: sin ella esto correria tambien
-- para el service_role y para el SQL a mano —donde `mi_rol()` devuelve
-- 'sin_perfil'— y congelaria las columnas para las migraciones y para la Edge
-- Function `ingesta`, que es como se carga la mitad de esta base.
create or replace function public.preservar_lo_clinico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and not public.puede_ver_clinico() then
    new.patologia        := old.patologia;
    new.medico_tratante  := old.medico_tratante;
    new.matricula_medico := old.matricula_medico;
    new.credencial_url   := old.credencial_url;
  end if;
  return new;
end $$;

drop trigger if exists preservar_lo_clinico on public.pacientes;
create trigger preservar_lo_clinico
  before update on public.pacientes
  for each row execute function public.preservar_lo_clinico();

create or replace function public.preservar_los_importes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and not public.puede_ver_plata() then
    new.aporte          := old.aporte;
    new.medio_pago      := old.medio_pago;
    new.pago_referencia := old.pago_referencia;
    new.aporte_desglose := old.aporte_desglose;
  end if;
  return new;
end $$;

drop trigger if exists preservar_los_importes on public.ong_dispensas;
create trigger preservar_los_importes
  before update on public.ong_dispensas
  for each row execute function public.preservar_los_importes();

-- El INSERT no lleva trigger, y es a proposito: el director medico ENTREGA en
-- el mostrador y ahi registra lo que cobro. Puede escribir el aporte al cargar
-- la entrega y no puede volver a verlo ni corregirlo despues. Es exactamente lo
-- que significa «cobra pero no audita la caja».
