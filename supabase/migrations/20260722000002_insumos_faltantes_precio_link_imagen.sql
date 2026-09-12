-- Insumos faltantes: campos extra tipo Proveedores (precio, link, imagen base64).
alter table insumos_faltantes
  add column if not exists precio numeric,
  add column if not exists link text,
  add column if not exists imagen text;
