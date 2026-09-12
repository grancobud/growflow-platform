-- Trazabilidad por planta (codigo unico para QR) + vinculo planta<->paciente
-- + habilitacion REPROCANN (plantas y m2 que la persona tiene permitidas).

-- 1) plantas: codigo unico + paciente asignado
alter table plantas add column if not exists codigo text;
alter table plantas add column if not exists paciente_id uuid references pacientes(id) on delete set null;

-- backfill de codigo para plantas existentes sin codigo
update plantas set codigo = 'GF-' || upper(substr(md5(id::text), 1, 5))
where codigo is null;

create unique index if not exists idx_plantas_codigo on plantas(codigo);
create index if not exists idx_plantas_paciente on plantas(paciente_id);

-- 2) pacientes: habilitacion REPROCANN
alter table pacientes add column if not exists plantas_habilitadas int;
alter table pacientes add column if not exists m2_habilitados numeric(6,2);

-- 3) recrear la vista resumen_plantas para incluir codigo y paciente
drop view if exists resumen_plantas;
create view resumen_plantas as
select
  p.id,
  p.codigo,
  coalesce(p.apodo, g.nombre, 'Sin nombre') as nombre,
  g.nombre as genetica,
  g.banco,
  g.tipo,
  p.fase,
  p.fecha_germinacion,
  (current_date - p.fecha_germinacion) as dias_de_vida,
  p.sustrato,
  p.maceta,
  p.ubicacion,
  p.slot,
  p.activa,
  p.paciente_id,
  pac.nombre_completo as paciente_nombre,
  (select max(e.fecha) from eventos e where e.planta_id = p.id and e.tipo = 'Riego') as ultimo_riego,
  (select count(*) from eventos e where e.planta_id = p.id) as total_eventos
from plantas p
left join geneticas g on g.id = p.genetica_id
left join pacientes pac on pac.id = p.paciente_id;
