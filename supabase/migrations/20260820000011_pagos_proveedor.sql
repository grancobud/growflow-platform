-- La deuda con proveedores, consultable (hueco encontrado en la auditoria).
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- EL PROBLEMA
-- La hoja `PAGO PROVEEDORES` (157 filas) es la unica fuente que liga PAGO con
-- ORDEN DE SERVICIO, y no se estaba leyendo. En la base quedo asi:
--
--   112 ordenes de servicio cargadas
--    55 con "SALDO PENDIENTE $X" escrito ADENTRO de la descripcion
--     0 columnas de saldo consultables
--     0 asientos de caja identificables como pago a proveedor
--
-- O sea: la plata esta en `ong_caja`, pero no se puede preguntar "cuanto le
-- debemos a Lisa Culti A". El saldo quedo en un texto, que sirve para leerlo de
-- a uno y para nada mas. Con $XX.XXX.XXX de compras y 20 proveedores, es el
-- hueco mas grande que quedaba.
--
-- POR QUE UNA TABLA DE PAGOS Y NO UNA COLUMNA `pagado`
-- Una orden se paga en varias veces —para eso existe la columna PAGO PARCIAL en
-- la planilla—. Con una columna `pagado` habria que mantenerla sincronizada a
-- mano y se desincroniza al primer pago que alguien corrija. Con una fila por
-- pago, el saldo se CALCULA y no puede mentir. Mismo criterio que el VPD y la
-- capacidad del area.

create table if not exists public.ong_pagos_proveedor (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  -- Se liga por el NUMERO de la orden (OS112), no por id: es lo que la planilla
  -- tiene y lo que la gente dice. `ong_documentos.numero` guarda ese mismo
  -- texto. Un pago puede llegar antes que su orden, y esto lo tolera.
  orden_servicio text,
  proveedor      text,
  fecha          date not null,
  monto          numeric(14,2) not null check (monto > 0),
  medio          text,
  -- ID Pago de la planilla: es la marca de idempotencia contra el reenvio.
  referencia     text,
  notas          text,
  creado_en      timestamptz not null default now()
);

create index if not exists ong_pagos_prov_os_idx   on public.ong_pagos_proveedor (orden_servicio);
create index if not exists ong_pagos_prov_prov_idx on public.ong_pagos_proveedor (proveedor);
create index if not exists ong_pagos_prov_fecha_idx on public.ong_pagos_proveedor (fecha desc);

-- Saldo POR ORDEN DE SERVICIO. Se calcula, no se guarda.
create or replace view public.v_saldo_ordenes as
select d.numero                                   as orden_servicio,
       d.proveedor,
       d.fecha,
       d.monto                                    as total,
       coalesce(sum(p.monto), 0)                  as pagado,
       d.monto - coalesce(sum(p.monto), 0)        as saldo,
       count(p.id)                                as pagos
  from public.ong_documentos d
  left join public.ong_pagos_proveedor p on p.orden_servicio = d.numero
 where d.numero is not null and d.numero <> '' and d.monto is not null
 group by d.numero, d.proveedor, d.fecha, d.monto;

-- Saldo POR PROVEEDOR: la pregunta que hoy no se puede hacer.
create or replace view public.v_saldo_proveedores as
select coalesce(proveedor, 'Sin proveedor')       as proveedor,
       count(*)                                    as ordenes,
       sum(total)                                  as comprado,
       sum(pagado)                                 as pagado,
       sum(saldo)                                  as saldo,
       count(*) filter (where saldo > 0)           as ordenes_con_saldo
  from public.v_saldo_ordenes
 group by 1;

alter table public.ong_pagos_proveedor enable row level security;

-- Patron de `ong_caja`: es informacion economica, la ve todo rol real y la
-- escriben los que manejan plata.
drop policy if exists ong_pagos_prov_ver on public.ong_pagos_proveedor;
create policy ong_pagos_prov_ver on public.ong_pagos_proveedor
  for select using (mi_rol() <> all (array['sin_perfil','demo']));

drop policy if exists ong_pagos_prov_escribir on public.ong_pagos_proveedor;
create policy ong_pagos_prov_escribir on public.ong_pagos_proveedor
  for all
  using      (mi_rol() = any (array['administrador','administrativo']))
  with check (mi_rol() = any (array['administrador','administrativo']));
