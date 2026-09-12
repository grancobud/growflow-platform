-- 1 m2 por paciente habilitado. Criterio confirmado por Gaston.
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- Completa lo que `reprocann_habilitados` dejo a proposito sin tocar: ahi se
-- puso plantas_habilitadas = 9 y se dejo m2_habilitados en null porque no habia
-- un valor defendible. Ahora si lo hay.
--
-- Va SOLO a los que tienen numero de REPROCANN, igual que las plantas: quien no
-- tiene numero no aporta cupo, ni de plantas ni de superficie.
--
-- Resultado: 70 vigentes, 630 plantas, 70 m2. Con esto la Constancia de cupo
-- deja de salir con el corchete [m2 habilitados].

update public.pacientes
   set m2_habilitados = coalesce(m2_habilitados, 1)
 where activo is not false
   and reprocann_nro is not null
   and btrim(reprocann_nro) <> '';
