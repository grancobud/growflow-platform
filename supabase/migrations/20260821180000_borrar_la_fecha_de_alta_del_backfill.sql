-- Saca la fecha del backfill de los 102 pacientes que no tienen de donde sacarla.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- LA TRAMPA DE LA FECHA DE BACKFILL, cuarta o quinta vez que aparece.
-- `20260821110000_fecha_alta_real_pacientes` recupero la fecha de alta de 109
-- pacientes desde su primera entrega, que es la unica prueba real de cuando
-- empezaron. A los otros 102 no los toco, y quedaron con lo que traian de la
-- carga: `2026-08-20`, el dia en que se corrio el backfill.
--
-- Mirando la distribucion salta solo:
--   2026-08-20 -> 102 pacientes
--   cualquier otra fecha -> 1 a 4 pacientes
--
-- No son 102 personas que se asociaron el mismo dia: es el default de la
-- migracion haciendose pasar por dato. Y son exactamente los 102 que no tienen
-- ninguna entrega, ningun documento y ninguna otra fuente: 0 de 102 tienen algo
-- de donde derivar la fecha (verificado).
--
-- LA MISMA PERSONA SE CONTRADECIA. `ong_asociados.fecha_alta` tiene a esos
-- mismos 102 en NULL, porque el padron se armo con el criterio correcto. Asi
-- que el legajo de una persona decia NULL de un lado y 2026-08-20 del otro.
--
-- Se pasan a NULL. Un alta sin fecha se ve en la pantalla como lo que es —un
-- dato que falta— y se puede completar cuando aparezca el papel. Una fecha
-- inventada no se ve, no se completa nunca, y si alguien pide el libro de
-- asociados sale declarando un alta que no ocurrio ese dia.
--
-- RESULTADO: 211 -> 109 pacientes con fecha de alta. El indicador empeora
-- porque dejo de mentir.
update public.pacientes p
set fecha_alta = null
where p.fecha_alta = date '2026-08-20'
  and not exists (select 1 from public.ong_dispensas d where d.paciente_id = p.id)
  and not exists (select 1 from public.ong_documentos g where g.paciente_id = p.id);
