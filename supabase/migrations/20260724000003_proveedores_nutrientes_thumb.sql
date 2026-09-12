-- Proveedores: mismo problema que insumos_faltantes (ver 20260724000002).
-- `imagen` guarda la foto como data URI base64 (4,6 MB en 67 filas) y el listado
-- hacía select('*'). Ahora la lista trae sólo la miniatura y la foto va on-demand.

alter table proveedores_nutrientes add column if not exists imagen_thumb text;

-- Permite saber si una fila tiene foto sin tener que traer la foto.
alter table proveedores_nutrientes
  add column if not exists tiene_imagen boolean
  generated always as (imagen is not null) stored;
