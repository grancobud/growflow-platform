-- La unidad del lote y de la dispensa (A3 de la orden de trabajo).
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- El modelo asumia que todo se mide en gramos: la columna se llama
-- `gramos_totales` y el balance de materia suma esa columna sin preguntar. Pero
-- la asociación dispensa tambien aceite (frascos), papeles, filtros, picadores y seda.
--
-- Hoy eso esta mezclado en la base:
--   - 5 lotes de "Aceite de Cannabis" con 21 en `gramos_totales` que son 21
--     FRASCOS, sumados junto a X.XXX g de flores.
--   - 37 dispensas / 80 "gramos" que no son gramos, dentro de los 6.747,5 del
--     balance. El material vegetal real es 6.667,5 g.
--
-- No se renombra `gramos_totales`: lo referencian la app, la Edge Function
-- `ingesta` y los scripts del backfill. Se agrega la unidad al lado y el codigo
-- filtra por ella.

alter table public.ong_lotes
  add column if not exists unidad text not null default 'g'
    check (unidad in ('g','u','ml'));

alter table public.ong_dispensas
  add column if not exists unidad text not null default 'g'
    check (unidad in ('g','u','ml'));

comment on column public.ong_lotes.unidad is
  'g = gramos de material vegetal · u = unidades (frascos, accesorios) · ml = mililitros. Solo lo marcado como g entra al balance de materia.';

-- Backfill por nombre de producto. Es lo unico que tenemos: la planilla nunca
-- registro la unidad. Se marca por patron y queda a la vista para corregir a
-- mano lo que haga falta.
update public.ong_lotes
   set unidad = 'u'
 where producto ~* 'aceite|papel|filtro|picador|seda|programa|grinder|encendedor|bandeja'
   and unidad = 'g';

update public.ong_dispensas
   set unidad = 'u'
 where producto ~* 'aceite|papel|filtro|picador|seda|programa|grinder|encendedor|bandeja'
   and unidad = 'g';

create index if not exists ong_dispensas_unidad_idx on public.ong_dispensas (unidad);
