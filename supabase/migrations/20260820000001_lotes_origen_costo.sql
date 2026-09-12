-- Origen y costo del lote (A1 de la orden de trabajo).
--
-- El modelo asumia que todo el material sale del cultivo propio: un lote nacia
-- de una cosecha (`cosecha_id`) y el costo por gramo lo calculaba Econometria a
-- partir de los insumos del ciclo. la asociación opera al reves — compra el material a
-- terceros con una orden de servicio — y con ese modelo su margen por lote no lo
-- calcula nadie: 101 lotes cargados, 0 cosechas, y $XX.XXX.XXX de compras que no
-- tienen donde imputarse.
--
-- Tres columnas alcanzan para cerrarlo:
--   origen           de donde salio el material. Es lo que permite sumar el
--                    ingreso real sin contar dos veces un lote propio, que ya
--                    viene contado en `cosechas`.
--   costo_por_gramo  lo que costo el gramo puesto en el estante. Nullable: el
--                    dato lo carga la persona, y un cero fingido daria margenes
--                    inventados.
--   proveedor        a quien se le compro. Texto libre a proposito: la planilla
--                    trae nombres sueltos y todavia no hay tabla de proveedores
--                    del lado ONG.

alter table public.ong_lotes
  add column if not exists origen text not null default 'propio'
    check (origen in ('propio','comprado')),
  add column if not exists costo_por_gramo numeric(12,2)
    check (costo_por_gramo is null or costo_por_gramo >= 0),
  add column if not exists proveedor text;

comment on column public.ong_lotes.origen is
  'propio = salio de una cosecha de la instalacion; comprado = se adquirio a un tercero.';
comment on column public.ong_lotes.costo_por_gramo is
  'Costo del gramo puesto en el estante. Null = todavia no se cargo, no cero.';

-- SOLO PARA LA BASE DE ASOCIACION (qivhrbsnvuaylqofpjti).
--
-- La regla general es que toda migracion va a las dos bases, pero esta no: A1
-- resuelve un problema de la asociación —que compra el material a terceros— y el repo
-- de Gaston (grancobud/growflow) no tiene el codigo que usa estas columnas. Se
-- aplico ahi por error el 20/08/2026 y se revirtio el mismo dia. Si algun dia se
-- porta A1 a growflow, se aplica esta migracion en esa base recien entonces.
--
-- Backfill: un lote que no viene de ninguna cosecha no pudo salir del cultivo
-- propio. En la asociación marca los 101 como comprados, que es lo que son.
update public.ong_lotes
   set origen = 'comprado'
 where cosecha_id is null
   and origen = 'propio';

create index if not exists ong_lotes_origen_idx on public.ong_lotes (origen);
