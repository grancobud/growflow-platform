-- Numeracion de recibos: correlativa, atomica, y asignada al EMITIR.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- `ong_dispensas.recibo_numero` esta en NULL en las 1.241, asi que el recibo
-- sale con "RECIBO OFICIAL NO COMERCIAL N° [numero]" en las 1.241.
--
-- POR QUE NO SE NUMERAN LAS 1.241 DE UNA. Un numero de recibo no es un dato que
-- se descubre: es un identificador que la entidad asigna cuando emite el papel.
-- Numerar las 1.241 hacia atras seria declarar que se emitieron 1.241 recibos
-- correlativos que nunca existieron, y ademas fabricar la evidencia de una
-- numeracion prolija que no ocurrio. Eso es exactamente lo que el resto de este
-- repo se niega a hacer.
--
-- LO QUE SI SE PUEDE: que el numero salga cuando el recibo se emite de verdad.
-- Una dispensa vieja de la que hoy se necesita el papel se numera hoy, y a
-- partir de ahi ese numero es suyo para siempre.
--
-- POR QUE UNA SECUENCIA Y NO max(recibo_numero) + 1. Dos personas emitiendo al
-- mismo tiempo con max+1 se llevan el mismo numero, y dos recibos con el mismo
-- numero es peor que ninguno numerado: rompe justamente la garantia por la que
-- un recibo se numera. `nextval` es atomico.
--
-- El indice unico es el cinturon: aunque alguien escriba el numero a mano desde
-- la pantalla, la base no deja que se repita. Es parcial (where not null)
-- porque los 1.241 NULL de hoy tienen que poder convivir.
--
-- LA SECUENCIA ARRANCA EN 1. Si la asociación ya tiene un talonario en papel empezado,
-- hay que correrla ANTES de emitir el primero:
--     select setval('public.ong_recibo_seq', <ultimo numero usado>);
-- Si no, el primer recibo de la app va a chocar con uno que ya existe en papel.
create sequence if not exists public.ong_recibo_seq as integer start 1;

create unique index if not exists ong_dispensas_recibo_numero_uk
  on public.ong_dispensas (recibo_numero)
  where recibo_numero is not null;

-- Idempotente a proposito: si la dispensa ya tiene numero devuelve el que
-- tiene, sin consumir uno nuevo. Reabrir un recibo emitido no puede
-- renumerarlo, y tocar el boton dos veces no puede quemar dos numeros.
create or replace function public.asignar_numero_recibo(p_dispensa uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- `security definer` saltea RLS, asi que el permiso se chequea a mano: sin
  -- esto cualquier usuario logueado podria numerar recibos.
  if mi_rol() not in ('administrador', 'administrativo') then
    raise exception 'Sin permiso para emitir recibos';
  end if;

  select recibo_numero into n from ong_dispensas where id = p_dispensa for update;
  if not found then
    raise exception 'No existe la dispensa %', p_dispensa;
  end if;
  if n is not null then
    return n;
  end if;

  n := nextval('ong_recibo_seq');
  update ong_dispensas set recibo_numero = n where id = p_dispensa;
  return n;
end;
$$;

revoke all on function public.asignar_numero_recibo(uuid) from public;
grant execute on function public.asignar_numero_recibo(uuid) to authenticated;
