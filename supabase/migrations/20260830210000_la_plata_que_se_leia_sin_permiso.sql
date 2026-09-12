-- Tres tablas con plata que leia cualquiera que tuviera cuenta.
--
-- Ya aplicado a mano sobre qivhrbsnvuaylqofpjti el 30/08/2026. NO en Chaco.
--
-- Salio de probar el rol `administrador_sistema`: en Tablas se veian los pagos a
-- proveedores con importe, proveedor y medio de pago. El rol prometia no mostrar
-- plata y mostraba $XXX.XXX, $X.XXX.XXX, $X.XXX.XXX.
--
-- EL AGUJERO NO ERA DEL ROL NUEVO. `ong_pagos_proveedor` y `ong_tarifas` tenian
-- la lectura en `mi_rol() <> ALL (ARRAY['sin_perfil','demo'])`, o sea ABIERTA a
-- todo el mundo menos la cuenta de muestra. Un `cultivador` —que por diseno no
-- ve «cuanto cuesta producir»— podia leerlas desde antes de que este rol
-- existiera.
--
-- LA LECCION: yo las habia excluido a mano del barrido de policies del rol nuevo
-- y me quede tranquilo. Excluir de una lista no cierra lo que nunca estuvo
-- cerrado. Al agregar un rol restringido hay que mirar que leen las OTRAS
-- policies de la tabla, no solo la que uno toca.
--
-- `ong_documentos` es otro caso: la lectura si estaba acotada, pero incluia al
-- rol nuevo, y esa tabla tiene $152,8 millones en 1.551 comprobantes
-- —aprovisionamiento, gastos operativos y las retribuciones de los socios—. De
-- ahi salia el «Retiros por socio: $XX.XXX.XXX» que se veia en Movimientos.
--
-- Verificado ejecutando COMO el rol: caja 0, cuotas 0, pagos 0, tarifas 0,
-- documentos 0, y plantas 75 —que si tiene que ver—.
--
-- QUEDA SIN DECIDIR, y son de cultivo, no de la caja:
--   · `sustancias_nutrientes.costo_kg`  · `cosechas.valoracion`
-- Las dos siguen abiertas a cualquiera con cuenta. Un cultivador probablemente
-- las necesita; hay que decidirlo, no barrerlo.

alter policy ong_pagos_prov_ver on public.ong_pagos_proveedor
  using (public.puede_ver_plata());

alter policy ong_tarifas_ver on public.ong_tarifas
  using (public.puede_ver_plata());

alter policy ong_documentos_ver on public.ong_documentos
  using (public.puede_ver_plata() or mi_rol() = 'director_medico');

alter policy ong_documentos_escribir on public.ong_documentos
  using (mi_rol() = any (array['administrador','director_medico','administrativo']))
  with check (mi_rol() = any (array['administrador','director_medico','administrativo']));
