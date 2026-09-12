-- UNA COLUMNA NUEVA NO LLEGA SOLA A LA APP.
--
-- La app no lee las tablas: lee `pacientes_segun_rol` y `dispensas_segun_rol`,
-- y una vista con columnas explicitas no se entera de lo que se le agrega a la
-- tabla de abajo. Sin esto, `tipo_movimiento` y `retira_como_retribucion`
-- llegaban SIEMPRE en undefined, y el interruptor "queda a deber" hubiera
-- clasificado como deuda hasta lo que retira el equipo. En silencio.
--
-- LAS COLUMNAS NUEVAS VAN AL FINAL: `create or replace view` no deja insertar
-- una en el medio ("cannot change name of view column"). Renombra por posicion,
-- no por nombre.
--
-- Las dos siguen SECURITY DEFINER, que es como estaban: `pacientes_segun_rol`
-- existe justamente para que cada rol vea lo suyo, y su barrera es el WHERE de
-- adentro. No se les toca ni el WHERE ni un solo CASE.

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
    codigo_vinculacion,
    -- No es dato clinico ni plata: es una condicion laboral, y la ve todo el
    -- que ve el padron. El mostrador la necesita para que el interruptor
    -- "queda a deber" diga la verdad.
    retira_como_retribucion
   FROM pacientes
  WHERE puede_ver_padron();

create or replace view public.dispensas_segun_rol as
 SELECT id, user_id, paciente_id, fecha, producto, genetica_id, gramos, unidad,
    modalidad, entregado_por, con_receta, notas, creado_en, recibo_numero,
    lote_codigo,
        CASE WHEN puede_ver_plata() THEN aporte ELSE NULL::numeric END AS aporte,
        CASE WHEN puede_ver_plata() THEN medio_pago ELSE NULL::text END AS medio_pago,
        CASE WHEN puede_ver_plata() THEN pago_referencia ELSE NULL::text END AS pago_referencia,
        CASE WHEN puede_ver_plata() THEN aporte_desglose ELSE NULL::jsonb END AS aporte_desglose,
    -- Que fue el movimiento no es plata: es lo que permite que el balance de
    -- materia deje de leer una operacion normal como un error.
    tipo_movimiento
   FROM ong_dispensas
  WHERE mi_rol() = ANY (ARRAY['administrador'::text, 'administrador_sistema'::text, 'director_medico'::text, 'administrativo'::text, 'auditor'::text]);

revoke all on public.pacientes_segun_rol from anon;
revoke all on public.dispensas_segun_rol from anon;
grant select on public.pacientes_segun_rol to authenticated;
grant select on public.dispensas_segun_rol to authenticated;
