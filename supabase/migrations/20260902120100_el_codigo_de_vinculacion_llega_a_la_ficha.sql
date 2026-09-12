-- La columna nueva no llega sola: `getPacientes` lee la VISTA, y una vista
-- creada con columnas explicitas no se entera de lo que se agrega a la tabla.
--
-- Va SIN `CASE`: el codigo de vinculacion no es dato clinico ni plata. Quien
-- puede ver el padron necesita verlo, porque es justo lo que hace falta para
-- vincular a la persona.
--
-- OJO: `CREATE OR REPLACE VIEW` solo deja AGREGAR columnas al final, y ademas
-- borra las reloptions si no se las repite. Aca no hay ninguna que perder
-- -esta vista es SECURITY DEFINER a proposito, igual que `pacientes_min`: su
-- barrera es el `WHERE puede_ver_padron()` de adentro y no el RLS-, pero se
-- verifica despues igual.
create or replace view public.pacientes_segun_rol as
 SELECT id, nombre_completo, dni, fecha_nacimiento, telefono, email,
    localidad, provincia, domicilio, foto_url,
    reprocann_nro, reprocann_estado, reprocann_emision, reprocann_vencimiento,
    modalidad, socio, fecha_alta, activo, notas, creado_en,
    plantas_habilitadas, m2_habilitados, tope_mensual_g, nivel_tarifa, codigo,
        CASE WHEN puede_ver_clinico() THEN patologia ELSE NULL::text END AS patologia,
        CASE WHEN puede_ver_clinico() THEN medico_tratante ELSE NULL::text END AS medico_tratante,
        CASE WHEN puede_ver_clinico() THEN matricula_medico ELSE NULL::text END AS matricula_medico,
        CASE WHEN puede_ver_clinico() THEN credencial_url ELSE NULL::text END AS credencial_url,
        CASE WHEN puede_ver_plata() THEN aporte_acordado_g ELSE NULL::numeric END AS aporte_acordado_g,
        CASE WHEN puede_ver_plata() THEN notas_economicas ELSE NULL::text END AS notas_economicas,
    codigo_vinculacion
   FROM pacientes
  WHERE puede_ver_padron();
