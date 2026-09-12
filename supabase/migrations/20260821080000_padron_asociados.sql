-- Arma el Libro de Registro de Asociados desde el padron de pacientes.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- `ong_asociados` estaba en 0 con 211 personas cargadas en `pacientes`. El
-- Libro de Asociados es uno de los 8 requisitos de la Res. 1780/2025 y las
-- personas ya estaban; faltaba el libro. La pantalla decia "Sin asociados
-- cargados".
--
-- LA FECHA DE ALTA SALE DE LA PRIMERA DISPENSA, no de `pacientes.fecha_alta`:
-- los 211 tienen fecha_alta = 2026-08-20, la del backfill. La primera entrega
-- es la primera prueba documentada de que la persona operaba con la
-- cooperativa. Los 102 sin ninguna dispensa quedan con fecha_alta NULL: el
-- padron muestra el hueco en vez de inventar una fecha.
--
-- `categoria` queda NULL a proposito. `pacientes.nivel_tarifa` es
-- nuevo/antiguo/frecuente —un eje de PRECIO, ver `ong_tarifas`— y
-- `ong_categorias_socio` dice Nivel 1/2/3. Son dos vocabularios distintos;
-- mapearlos seria inventar una correspondencia que nadie definio.
--
-- `mandato_aceptado` y `fundador` quedan en false, y `acta_alta_id` en NULL:
-- son un documento firmado y un acta de comision directiva. No se derivan.
--
-- RESULTADO: 211 asociados, 0 duplicados, 109 con fecha de alta real
-- (02/08/2025 a 19/08/2026), 70 vinculados a REPROCANN.
-- `fecha_vinculacion` queda en 0 porque `pacientes.reprocann_emision` esta
-- vacio en los 211: hueco real de la base, no del insert.
insert into public.ong_asociados
  (nombre, dni, paciente_id, legajo, activo, fecha_alta,
   vinculado_reprocann, fecha_vinculacion, notas)
select p.nombre_completo, p.dni, p.id, p.codigo, p.activo,
       (select min(d.fecha) from public.ong_dispensas d where d.paciente_id = p.id),
       (p.reprocann_estado = 'Vigente' and coalesce(btrim(p.reprocann_nro),'') <> ''),
       p.reprocann_emision,
       'Alta derivada de la primera dispensa registrada. Mandato y acta pendientes de carga.'
  from public.pacientes p
 where not exists (select 1 from public.ong_asociados a where a.paciente_id = p.id);
