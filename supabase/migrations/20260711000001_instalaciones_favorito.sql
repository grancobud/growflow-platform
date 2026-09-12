-- Flag "favorito" en insumos de instalacion: el usuario marca con estrella
-- lo que decidio comprar (a nivel item, como el elegido de las ofertas).
alter table if exists public.instalaciones_items
  add column if not exists favorito boolean not null default false;
