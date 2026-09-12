-- C3 (codigo de paciente) y C4 (sub-fase). Los dos ultimos de la orden de trabajo.
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- C3 -- `pacientes` no tenia campo de codigo, asi que el PAC-XXX no tenia donde
-- ir y termino viviendo en `notas`, como prefijo antes de un `|`. Eso obliga a
-- que TODO el que quiera el codigo haga split_part(notas,'|',1) —lo hacen la
-- Edge Function, el trigger y media consulta que escribi hoy— y deja el dato
-- expuesto a que alguien edite las notas y lo borre sin darse cuenta.
--
-- ORDEN IMPORTANTE: la Edge Function ya se deployo leyendo `codigo` con
-- fallback a `notas`, ANTES de esta migracion. Si se hiciera al reves, entre el
-- momento de limpiar las notas y el de redeployar la funcion, las dispensas
-- entrarian sin poder vincular a su paciente.

alter table public.pacientes
  add column if not exists codigo text;

create unique index if not exists pacientes_codigo_uk
  on public.pacientes (codigo) where codigo is not null;

comment on column public.pacientes.codigo is
  'PAC-XXX. Antes vivia como prefijo de `notas`; se mudo aca para que no dependa de que nadie edite ese texto.';

-- 1. Mudar el codigo de notas a su columna.
update public.pacientes
   set codigo = btrim(split_part(notas, '|', 1))
 where codigo is null
   and notas ~ '^\s*PAC-\d+';

-- 2. Sacar el prefijo de notas. Lo que queda es lo que siempre fue: el texto
--    crudo del formulario.
update public.pacientes
   set notas = nullif(btrim(substr(notas, strpos(notas, '|') + 1)), '')
 where codigo is not null
   and notas ~ '^\s*PAC-\d+\s*\|';

-- 3. El trigger pasa a escribir la columna. Sigue respetando el que ya viene
--    cargado y sigue serializado con el advisory lock: dos altas simultaneas no
--    pueden llevarse el mismo numero.
create or replace function public.asignar_codigo_paciente()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  proximo int;
begin
  if coalesce(new.codigo, '') ~ '^\s*PAC-\d+' then
    return new;
  end if;

  -- Compatibilidad: si alguien todavia manda el codigo dentro de notas, se
  -- respeta y se mueve a su lugar en vez de asignar uno nuevo.
  if coalesce(new.notas, '') ~ '^\s*PAC-\d+' then
    new.codigo := btrim(split_part(new.notas, '|', 1));
    new.notas  := nullif(btrim(substr(new.notas, strpos(new.notas, '|') + 1)), '');
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('pacientes_codigo'));

  select coalesce(max(nullif(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0) + 1
    into proximo
    from public.pacientes
   where codigo ~ '^\s*PAC-\d+';

  new.codigo := 'PAC-' || lpad(proximo::text, 3, '0');
  return new;
end;
$$;

-- C4 -- La sub-fase. Columna suelta y NO una fase nueva: FASES_COSECHABLES y
-- media app razonan sobre `fase`, y meter variantes ahi obligaria a revisar
-- cada comparacion. Como sub-fase suma cuando esta y no molesta cuando falta.
alter table public.plantas
  add column if not exists subfase text;

comment on column public.plantas.subfase is
  'Detalle dentro de la fase: "Temprano", "Engorde", "Lavado". Opcional. Ver SUBFASES en app/src/lib/cultivo.ts.';
