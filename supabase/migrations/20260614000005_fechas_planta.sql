-- Fechas de cosecha y envasado a nivel planta (se muestran en la historia clinica / QR).
alter table plantas add column if not exists fecha_cosecha date;
alter table plantas add column if not exists fecha_envasado date;
