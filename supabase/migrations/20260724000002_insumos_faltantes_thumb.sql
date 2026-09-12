-- Insumos faltantes: miniatura separada de la foto grande.
-- La foto (`imagen`) se guarda como data URI base64 y llegó a pesar 829 kB por fila;
-- el listado hacía select('*') y bajaba ~4,7 MB para dibujar thumbnails de 44x44 px.
-- Ahora la lista trae sólo `imagen_thumb` (~6 kB) y la foto grande se pide on-demand.

alter table insumos_faltantes add column if not exists imagen_thumb text;

-- Permite saber si una fila tiene foto sin tener que traer la foto.
alter table insumos_faltantes
  add column if not exists tiene_imagen boolean
  generated always as (imagen is not null) stored;
