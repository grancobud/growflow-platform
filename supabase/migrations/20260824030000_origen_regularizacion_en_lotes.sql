-- Un ajuste de inventario no es una compra, y hasta ahora habia que disfrazarlo
-- de una.
--
-- `ong_lotes.origen` solo aceptaba 'propio' o 'comprado'. Cuando aparece
-- material que ya se entrego y cuyo ingreso no quedo documentado —el 24/08/2026
-- fueron 1.684,5 g, al completar 107 entregas cargadas con el aporte cobrado y
-- la cantidad en cero— no hay forma honesta de registrarlo con esas dos
-- opciones: 'propio' diria que salio del cultivo, y 'comprado' diria que se le
-- compro a alguien. Las dos serian falsas, y la segunda ademas obliga a
-- inventar un proveedor.
--
-- 'regularizacion' dice lo unico que se sabe de verdad: que ese material estuvo,
-- y que su ingreso no esta documentado. Declarar el hueco es lo que se espera de
-- quien ordena sus registros; taparlo con un proveedor que no se puede
-- verificar es lo contrario, y deja peor parada a la asociacion que el hueco.
--
-- Para el BALANCE DE MATERIA sigue contando como ingreso —el material existio y
-- se entrego— y por eso `loteEsComprado` lo toma igual: mira que no sea 'propio'
-- y que no tenga cosecha, y eso no cambia.

alter table public.ong_lotes drop constraint if exists ong_lotes_origen_check;

alter table public.ong_lotes add constraint ong_lotes_origen_check
  check (origen = any (array['propio'::text, 'comprado'::text, 'regularizacion'::text]));

comment on column public.ong_lotes.origen is
  'propio = salio del cultivo. comprado = se le compro a un proveedor. regularizacion = material que estuvo y cuyo ingreso no quedo documentado; NO se le inventa proveedor.';
