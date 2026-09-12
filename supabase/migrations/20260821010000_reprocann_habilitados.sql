-- Los que tienen numero de tramite pasan a contar como habilitados.
--
-- SOLO PARA LA BASE DE ASOCIACION. Ver el comentario completo en la migracion
-- aplicada (mismo nombre) — resumen:
--
-- DECISION DE ASOCIACION: "los que tienen numero de registro se inicio y se
-- autorizo el tramite". Se verificara contra el Ministerio a futuro.
--
-- Antes: 70 con numero, todas 'En tramite', CERO con plantas_habilitadas. Por
-- eso Pacientes decia "0 plantas habilitadas sobre 211" y Cupo mostraba 0/9.
--
-- plantas_habilitadas = 9 es el cupo estandar por paciente en floracion,
-- confirmado por Gaston, y es el mismo default que cupoReprocann() ya usaba
-- cuando la columna venia en null. Esto lo hace explicito en el dato.
--
-- NO se tocan `m2_habilitados` ni `tope_mensual_g`: no hay valor defendible
-- para ninguno y el propio codigo dice que el tope "no es un valor que el
-- sistema pueda inventar - sale del REPROCANN de cada paciente". Un tope falso
-- hace que la ventana de 30 dias valide contra un numero inventado, que es peor
-- que no validar.

update public.pacientes
   set reprocann_estado = 'Vigente',
       plantas_habilitadas = coalesce(plantas_habilitadas, 9)
 where activo is not false
   and reprocann_nro is not null
   and btrim(reprocann_nro) <> ''
   and reprocann_estado = 'En tramite';
