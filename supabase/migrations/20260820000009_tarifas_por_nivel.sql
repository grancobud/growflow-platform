-- A2: tarifas por nivel de socio.
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- EL CRITERIO, EN PALABRAS DE ASOCIACION (20/08/2026):
--   "calidad y cantidad que se dispensa, generalmente usuarios nuevos y random
--    15, usuarios que estan desde que empezamos x ej 12 y determinados usuarios
--    x cantidad y frecuencia 10"
--
-- Existia y no estaba escrito en ningun lado: se aplicaba a ojo, entrega por
-- entrega. Contrastado contra el ano cargado, el criterio se confirma:
--
--   nivel       pacientes  dias activos  g por entrega
--   antiguo 12k     37         148           4,6      <- los del dia 1
--   frecuente 10k   21          84           5,9      <- los de mas volumen
--   nuevo 15k       32          81           4,0      <- nuevos y ocasionales
--
-- La antiguedad explica los 12k (148 dias contra 81-84), y la cantidad por
-- entrega ordena los tres de forma monotona.
--
-- DOS DECISIONES QUE IMPORTAN
--
-- 1. La tarifa lleva `vigente_desde` y no es un valor unico. Los datos muestran
--    que se movio: la mediana paso de 12.000 a 15.000 en 2026-T2. Sin vigencia
--    no se puede reconstruir que regia cuando se hizo una entrega, y un recibo
--    viejo dejaria de poder explicarse.
--
-- 2. La tarifa SUGIERE, no impone. 703 de los 704 aportes cargados son multiplos
--    de $X.XXX: cobran en pesos redondos y la tarifa por gramo es el resultado,
--    no la entrada. Ademas la calidad del lote la modula. Un sistema que
--    obligara a `gramos * tarifa` estaria peleado con como trabajan.

create table if not exists public.ong_tarifas (
  id               uuid primary key default gen_random_uuid(),
  nivel            text not null check (nivel in ('nuevo','antiguo','frecuente')),
  aporte_por_gramo numeric(12,2) not null check (aporte_por_gramo >= 0),
  vigente_desde    date not null,
  notas            text,
  creado_en        timestamptz not null default now(),
  unique (nivel, vigente_desde)
);

create index if not exists ong_tarifas_nivel_idx on public.ong_tarifas (nivel, vigente_desde desc);

alter table public.pacientes
  add column if not exists nivel_tarifa text not null default 'nuevo'
    check (nivel_tarifa in ('nuevo','antiguo','frecuente'));

comment on column public.pacientes.nivel_tarifa is
  'nuevo = tarifa plena · antiguo = desde el inicio · frecuente = por cantidad y frecuencia. El default es `nuevo`, la mas alta: una persona sin evaluar no entra por la mas barata.';

-- Las tarifas vigentes hoy, tal como las dicta la asociación.
insert into public.ong_tarifas (nivel, aporte_por_gramo, vigente_desde, notas)
select * from (values
  ('nuevo',      15000::numeric, date '2026-04-01', 'Usuarios nuevos y ocasionales.'),
  ('antiguo',    12000::numeric, date '2025-08-02', 'Socios desde el inicio de la cooperativa.'),
  ('frecuente',  10000::numeric, date '2025-08-02', 'Por cantidad y frecuencia de retiro.')
) as t(nivel, aporte_por_gramo, vigente_desde, notas)
where not exists (select 1 from public.ong_tarifas);

-- Backfill del nivel: la tarifa que MAS uso cada paciente en su historia. Es lo
-- que ya se le venia cobrando, no una clasificacion nueva. Quien no tenga
-- historia suficiente queda en `nuevo`, que es el default y la tarifa mas alta:
-- errar hacia arriba se corrige devolviendo, errar hacia abajo no se corrige.
with d as (
  select paciente_id, round(aporte / nullif(gramos,0)) pg
  from public.ong_dispensas
  where modalidad='Paciente' and unidad='g' and gramos>0 and aporte>0 and paciente_id is not null
), moda as (
  select paciente_id, mode() within group (order by pg) tarifa
  from d group by 1
)
update public.pacientes p
   set nivel_tarifa = case m.tarifa
                        when 10000 then 'frecuente'
                        when 12000 then 'antiguo'
                        else 'nuevo'
                      end
  from moda m
 where m.paciente_id = p.id
   and m.tarifa in (10000, 12000, 15000);

alter table public.ong_tarifas enable row level security;

drop policy if exists ong_tarifas_ver on public.ong_tarifas;
create policy ong_tarifas_ver on public.ong_tarifas
  for select using (mi_rol() <> all (array['sin_perfil','demo']));

drop policy if exists ong_tarifas_escribir on public.ong_tarifas;
create policy ong_tarifas_escribir on public.ong_tarifas
  for all
  using      (mi_rol() = any (array['administrador','administrativo']))
  with check (mi_rol() = any (array['administrador','administrativo']));
