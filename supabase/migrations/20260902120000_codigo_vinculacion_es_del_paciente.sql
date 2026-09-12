-- EL CODIGO DE VINCULACION ES DE LA PERSONA, NO DE LA ENTIDAD (02/09/2026).
--
-- Lo corrigio la asociación: cada paciente saca SU codigo en REPROCANN -Mi Argentina,
-- gratis, lo hace solo- y se lo da a la asociacion, que con eso lo vincula. El
-- sistema lo tenia al reves: una sola columna en `ong_entidad` y una pantalla
-- que decia que la ONG le pasaba ese numero a la gente.
--
-- El circuito publico ya estaba bien: `/sumate` le dice a la persona que el
-- primer paso es sacar su codigo. Era el lado de adentro el que se contradecia
-- con el de afuera.
--
-- POR QUE NO SE BORRA `ong_entidad.codigo_vinculacion`: esa columna existe en
-- las TRES bases y las otras dos no tienen este codigo. Un `drop column` aca
-- deja el esquema divergente por una limpieza que no cambia nada -en la asociación
-- esta en NULL-, y el comentario alcanza para que nadie la vuelva a usar.
alter table public.pacientes
  add column if not exists codigo_vinculacion text;

comment on column public.pacientes.codigo_vinculacion is
  'El codigo que la persona saca en REPROCANN y le da a la asociacion para que '
  'lo vincule como su cultivador. Es de la PERSONA: uno por paciente.';

comment on column public.ong_entidad.codigo_vinculacion is
  'EN DESUSO desde el 02/09/2026. El codigo de vinculacion es de cada paciente '
  '(pacientes.codigo_vinculacion), no de la entidad. Se conserva la columna '
  'porque existe igual en las otras dos instalaciones, que no tienen este '
  'cambio. No leerla ni escribirla.';
