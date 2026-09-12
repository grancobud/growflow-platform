-- Econometría real: el costo por gramo daba $0 porque el modelo no usaba nada
-- del Stock, y el "CAPEX" salía del catálogo de Instalaciones -- que es un
-- presupuesto de cosas que NO están compradas.
-- Ahora el costo se calcula con lo que hay instalado.

-- Cómo pesa cada insumo en el costo. null = se deduce de la categoría.
alter table insumos add column if not exists clase_costo text
  check (clase_costo in ('capex','consumible','recurrente'));

comment on column insumos.clase_costo is
  'capex = equipo instalado, se amortiza. consumible = se gasta por ciclo. recurrente = gasto mensual.';

create table if not exists econometria_config (
  clave text primary key,
  valor jsonb not null,
  actualizado_en timestamptz not null default now()
);

alter table econometria_config enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='econometria_config' and policyname='auth_econometria_config') then
    create policy auth_econometria_config on econometria_config
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Vida útil realista por categoría (meses), definida con Gastón.
insert into econometria_config (clave, valor) values
  ('vida_util_meses', '{
     "Iluminacion": 48, "Climatizacion": 72, "Riego": 60, "Medicion": 36,
     "Herramienta": 36, "CO2": 60, "Otro": 60, "Sustrato": 12,
     "Fertilizante": 12, "Sanidad": 12
   }'::jsonb),
  ('parametros', '{"meses_ciclo": 4, "dias_recarga_co2": 4, "precio_recarga_co2": 10000}'::jsonb)
on conflict (clave) do update set valor = excluded.valor, actualizado_en = now();

-- Clasificación del inventario existente.
update insumos set clase_costo = 'capex'
 where categoria in ('Iluminacion','Riego','Climatizacion','Medicion','Herramienta');

-- CO2: garrafa/regulador/válvula/mangueras son de la sala; las recargas se gastan.
update insumos set clase_costo = case
    when nombre ilike '%recarga%' then 'consumible' else 'capex' end
 where categoria = 'CO2';

update insumos set clase_costo = 'consumible'
 where categoria in ('Fertilizante','Sustrato','Sanidad');

-- Otro: PC/mouse/cable/maceta son equipo; semillas por ciclo; Growcast es mensual.
update insumos set clase_costo = case
    when nombre ilike '%growcast%' then 'recurrente'
    when nombre ilike '%genetic%' or nombre ilike '%semilla%' then 'consumible'
    else 'capex' end
 where categoria = 'Otro';

-- Gastos recurrentes reales (sin esto el costo mensual daba $0).
insert into costos (nombre, tipo, categoria, monto, periodicidad, cantidad, notas) values
  ('Alquiler del lugar',         'fijo',     'Alquiler',    300000, 'mensual', 1, null),
  ('Luz eléctrica',              'fijo',     'Luz (abono)', 300000, 'mensual', 1, '~13,8 kW instalados'),
  ('Internet + Growcast Premium','fijo',     'Internet',    100000, 'mensual', 1, null),
  ('Agua',                       'variable', 'Agua',         30000, 'mensual', 1, 'Riego y ósmosis'),
  ('Recargas de CO2',            'variable', 'Otro',         76000, 'mensual', 1, '1 recarga de $XX.XXX cada 4 días (~7,6/mes)')
on conflict do nothing;
