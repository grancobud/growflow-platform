-- Unificar los nombres que son el mismo escrito distinto.
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- Aparecio contrastando la hoja Dashboard de la planilla. Su bloque
-- "Socio / Total Retirado" da 8.833.000 para Socio y 7.934.870 para Socio; la
-- base daba menos, y la diferencia estaba en filas con el nombre en MAYUSCULAS:
--
--   Socio 8.580.000 (142 filas) + CRISTIAN 253.000 (12) = 8.833.000
--   Socio     7.609.870  (83 filas) + HUGO     325.000  (7) = 7.934.870
--
-- No falta plata: la planilla los une con una comparacion que ignora
-- mayusculas, y la base los ve como personas distintas. Cualquier pantalla que
-- agrupe por beneficiario mostraria a Socio dos veces.
--
-- Las variantes en mayusculas son TODAS del 02/08 al 23/08/2025, el tramo de
-- migracion inicial; las normales arrancan a fines de agosto, con el formulario.
-- O sea: dos cargas de la misma persona, no dos personas.
--
-- En `ong_pagos_proveedor` pasa lo mismo con `lisa` y `Lisa`, que en las otras
-- dos tablas figura siempre como `Lisa Culti A` — esa es la forma canonica.
--
-- NO se toca `N/A` (300 filas, $XX.XXX.XXX). No es un nombre mal escrito: es el
-- marcador de "no aplica" de los gastos operativos, que no tienen beneficiario.
-- Reinterpretarlo seria decidir por ellos.

update public.ong_documentos set proveedor = 'Socio' where proveedor = 'CRISTIAN';
update public.ong_documentos set proveedor = 'Socio'     where proveedor = 'HUGO';

update public.ong_pagos_proveedor
   set proveedor = 'Lisa Culti A'
 where lower(btrim(proveedor)) = 'lisa';

-- Los espacios sobrantes tampoco: " Socio" y "Socio" son el mismo y agrupan
-- distinto. Las dos vias automaticas —el Apps Script y la Edge Function— ya
-- hacen trim, asi que esto limpia lo que entro por SQL o a mano.
update public.ong_documentos      set proveedor = btrim(proveedor) where proveedor <> btrim(proveedor);
update public.ong_pagos_proveedor set proveedor = btrim(proveedor) where proveedor <> btrim(proveedor);
update public.ong_lotes           set proveedor = btrim(proveedor) where proveedor <> btrim(proveedor);

-- Aplicada el 20/08/2026. Filas efectivamente tocadas:
--   CRISTIAN -> Socio      12
--   HUGO     -> Socio           7
--   lisa/Lisa -> Lisa Culti A  8
-- Los tres btrim() no tocaron nada (0 filas en las tres tablas); quedan porque
-- son idempotentes y cubren lo que entre despues por SQL o a mano.
--
-- Verificacion contra la hoja Dashboard, exacta:
--   Socio 8.833.000   Socio 7.934.870
-- El saldo con proveedores no se movio (32.381.999,96): la vista liga los pagos
-- por orden de servicio, no por el nombre, asi que unificar la grafia agrupa la
-- pantalla sin tocar la contabilidad.
