-- EL ARQUEO: LO QUE ALGUIEN CONTO, CONTRA LO QUE EL SISTEMA DECIA.
--
-- Es lo que Socio pidio el 02/09/2026 y lo que al panel le faltaba. El panel
-- MUESTRA la caja y el stock; nadie sabe si alguien los miro. Sus palabras:
-- «deberia quedar registro de cada movimiento», «Socio controla y me pasas el
-- reporte», y el problema concreto: «hay veces que hay una merma, le pregunto a
-- Socio, no saco, yo no saque, no sabemos donde va».
--
-- Sin esta tabla esa pregunta no tiene respuesta posible: no hay ningun momento
-- registrado en el que alguien haya dicho «habia tanto».
--
-- SE GUARDA LA DIFERENCIA, NO SE IMPUTA A NADIE. `contado_por` dice quien conto,
-- que es distinto de quien se llevo algo. Hoy la merma la absorbe Socio como
-- faltante de su plata; un sistema que convierta eso en automatico deja de
-- cargarse la primera vez que alguien discuta un numero. El dato queda; que se
-- hace con el lo decide una persona.
create table if not exists public.arqueos (
  id uuid primary key default gen_random_uuid(),
  momento timestamptz not null default now(),

  -- LO QUE EL SISTEMA DECIA en ese momento, congelado.
  --
  -- Se guarda y no se recalcula: el esperado de hace tres semanas depende de
  -- asientos y dispensas que despues se corrigieron, asi que recalcularlo daria
  -- otro numero y la diferencia historica cambiaria sola. Un arqueo que cambia
  -- despues de firmado no sirve para nada.
  esperado_efectivo numeric(14,2),
  esperado_transferencia numeric(14,2),
  esperado_stock_g numeric(12,2),

  -- LO QUE SE CONTO. Nullable a proposito: se puede arquear solo la caja, solo
  -- el stock, o las dos. Obligar a contar todo junto es la forma segura de que
  -- no se cuente nada.
  contado_efectivo numeric(14,2),
  contado_transferencia numeric(14,2),
  contado_stock_g numeric(12,2),

  nota text,
  contado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists arqueos_momento_idx on public.arqueos (momento desc);
alter table public.arqueos enable row level security;

create policy arqueos_ver on public.arqueos
  for select to authenticated using (puede_ver_plata());
create policy arqueos_cargar on public.arqueos
  for insert to authenticated with check (puede_ver_plata());

-- NO HAY UPDATE NI DELETE, y es a proposito: un arqueo es una foto de un
-- momento. Si se conto mal, se carga otro; corregir el anterior borraria la
-- unica evidencia de que la diferencia existio.

-- Y `anon` no toca nada. La tabla nueva heredo el privilegio por el default de
-- Supabase; el 01/09 se lo quito sobre TODAS las tablas para que no alcance con
-- un solo error. Una tabla nueva vuelve a abrir ese agujero en silencio.
revoke all on public.arqueos from anon;

comment on table public.arqueos is
  'Lo que alguien conto de caja y stock, contra lo que el sistema decia. '
  'Sin update ni delete: un arqueo es una foto y se corrige cargando otro.';
