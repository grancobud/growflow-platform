-- Le pone a cada paciente su fecha de alta real. SOLO PARA LA BASE DE ASOCIACION.
--
-- Los 211 tenian fecha_alta = 2026-08-20, la del backfill, igual que pasaba
-- con los lotes: decia que los 211 se asociaron todos el mismo dia, catorce
-- meses despues de que empezaran a retirar material.
--
-- La primera dispensa registrada es la primera prueba documentada de que la
-- persona operaba con la cooperativa. Mismo criterio que ya se uso para
-- `ong_asociados.fecha_alta`, y los deja consistentes entre si.
--
-- SOLO SE TOCAN LOS 109 QUE TIENEN ENTREGAS. Los otros 102 no tienen ninguna
-- prueba de cuando entraron: se les deja la fecha del backfill antes que
-- inventarles una. Se distinguen porque en `ong_asociados` su fecha_alta es
-- NULL.
--
-- RESULTADO: 109 con fecha real desde 2025-08-02, 0 entregas anteriores al alta.
update public.pacientes p
   set fecha_alta = x.primera
  from (select d.paciente_id, min(d.fecha) primera
          from public.ong_dispensas d
         where d.paciente_id is not null
         group by 1) x
 where p.id = x.paciente_id
   and p.fecha_alta is distinct from x.primera;
