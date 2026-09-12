-- Endurecimiento de seguridad + índices faltantes (25/07/2026).
-- Todo verificado con `set local role anon` antes y después.

-- 1) resumen_plantas corría como SECURITY DEFINER: se saltaba las RLS de las
--    tablas base. Con GRANT SELECT al rol `anon` y la anon key horneada en el
--    bundle público, cualquiera leía las 45 plantas SIN LOGUEARSE, incluida la
--    columna paciente_nombre. Medido: anon veía 45 filas; ahora ve 0.
alter view public.resumen_plantas set (security_invoker = on);

-- 2) search_path mutable: un schema malicioso en el path podría secuestrar las
--    referencias a tablas/operadores dentro de la función.
alter function public.set_actualizado_en() set search_path = public;
alter function public.match_documentos(vector, integer) set search_path = public, extensions;

-- 3) Los buckets `fotos` y `documentos` tenían una policy SELECT para `anon`
--    sobre storage.objects: permitía ENUMERAR todos los archivos sin login
--    (27 credenciales de pacientes en PDF quedaban listadas).
--    En un bucket público el acceso por URL no pasa por estas policies, así que
--    quitarlas no rompe getPublicUrl(); sólo corta la enumeración.
drop policy if exists "fotos_public_read" on storage.objects;
drop policy if exists "docs_public_read" on storage.objects;

-- 4) Foreign keys sin índice de cobertura: seq scan en los joins y borrados en
--    cascada caros desde la tabla padre.
create index if not exists idx_actividades_cultivador on actividades(cultivador_id);
create index if not exists idx_asistencias_cultivador on asistencias(cultivador_id);
create index if not exists idx_ofertas_instalacion_proveedor on ofertas_instalacion(proveedor_id);
create index if not exists idx_plantas_madre on plantas(madre_id);
create index if not exists idx_presupuesto_items_item on presupuesto_instalacion_items(item_id);
create index if not exists idx_recordatorios_planta on recordatorios(planta_id);
