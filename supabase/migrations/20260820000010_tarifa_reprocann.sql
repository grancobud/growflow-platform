-- A2 v2: la tarifa combina NIVEL DE SOCIO y REPROCANN.
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- Decision de la asociación del 20/08/2026: al criterio de nivel se le suma el
-- REPROCANN, con el objetivo explicito de EMPUJAR A QUE LO TRAMITEN. Quien lo
-- tiene o lo esta tramitando paga menos; quien no, paga la tarifa de transicion
-- mientras lo gestiona.
--
-- EL PROBLEMA QUE HABIA QUE RESOLVER PRIMERO
--
-- Los 211 pacientes estaban en 'En tramite'. No porque lo esten: el formulario
-- ofrecia UNA sola opcion que decia "Tengo REPROCANN VIGENTE / VENCIDO /
-- PENDIENTE" —tres estados en una casilla— y la carga del ano pasado, bien, los
-- puso a todos en el estado no habilitado antes que marcar a alguien como
-- habilitado sin prueba.
--
-- Con todos en el mismo estado, el criterio nuevo no distingue a nadie y el
-- incentivo no existe. la asociación define el corte: "los que tienen numero de
-- registro se inicio y se autorizo el tramite". O sea, el NUMERO es la prueba.
--
-- Se agrega el estado 'Sin registro' y los 141 sin numero pasan ahi. Ojo con lo
-- que esto NO hace: no habilita a nadie. 'Sin registro' es tan no-habilitado
-- como 'En tramite'; lo unico que cambia es que ahora se distinguen, que es lo
-- que hace falta para que la tarifa signifique algo. Es reversible: el dia que
-- alguien traiga su numero, se carga y vuelve a 'En tramite'.

alter table public.pacientes drop constraint if exists pacientes_reprocann_estado_check;
alter table public.pacientes add constraint pacientes_reprocann_estado_check
  check (reprocann_estado = any (array['Vigente','En tramite','Vencido','Rechazado','Sin registro']));

update public.pacientes
   set reprocann_estado = 'Sin registro'
 where reprocann_estado = 'En tramite'
   and (reprocann_nro is null or btrim(reprocann_nro) = '');

-- LA MATRIZ
--
-- `reprocann` nullable a proposito: las filas historicas quedan en NULL porque
-- el criterio viejo NO distinguia por REPROCANN. Sin eso, un recibo de 2025 no
-- se podria explicar con la tabla. La busqueda prefiere la fila que matchea
-- nivel + reprocann y cae a la de nivel + NULL si no hay.
alter table public.ong_tarifas
  add column if not exists reprocann text
    check (reprocann is null or reprocann in ('si','tramite','no'));

alter table public.ong_tarifas drop constraint if exists ong_tarifas_nivel_vigente_desde_key;
drop index if exists ong_tarifas_combo_uk;
create unique index if not exists ong_tarifas_combo_uk
  on public.ong_tarifas (nivel, coalesce(reprocann,'-'), vigente_desde);

comment on column public.ong_tarifas.reprocann is
  'si = vigente · tramite = iniciado (tiene numero) · no = sin registro. NULL = fila del criterio viejo, que no distinguia.';

-- Nueve celdas explicitas. Se podria comprimir —tramite paga igual que si, y
-- todos los `no` pagan lo mismo— pero explicito se cambia una celda sin tocar
-- ninguna otra, y es la tabla que alguien va a leer para entender que se cobra.
insert into public.ong_tarifas (nivel, reprocann, aporte_por_gramo, vigente_desde, notas)
select * from (values
  ('frecuente','si',      10000::numeric, date '2026-08-20', 'Volumen y frecuencia, con REPROCANN.'),
  ('frecuente','tramite', 10000::numeric, date '2026-08-20', 'Tramite iniciado: mismo beneficio que vigente.'),
  ('frecuente','no',      15000::numeric, date '2026-08-20', 'Transicion mientras tramita.'),
  ('antiguo','si',        12000::numeric, date '2026-08-20', 'Socio del inicio, con REPROCANN.'),
  ('antiguo','tramite',   12000::numeric, date '2026-08-20', 'Tramite iniciado: mismo beneficio que vigente.'),
  ('antiguo','no',        15000::numeric, date '2026-08-20', 'Transicion mientras tramita.'),
  ('nuevo','si',          12000::numeric, date '2026-08-20', 'El REPROCANN baja al nuevo de 15 a 12: es el incentivo.'),
  ('nuevo','tramite',     12000::numeric, date '2026-08-20', 'Tramite iniciado: mismo beneficio que vigente.'),
  ('nuevo','no',          15000::numeric, date '2026-08-20', 'Transicion mientras tramita.')
) as t(nivel, reprocann, aporte_por_gramo, vigente_desde, notas)
where not exists (
  select 1 from public.ong_tarifas where vigente_desde = date '2026-08-20'
);
