-- Agrega el nivel 'acuerdo' para que los aportes pactados por fuera del esquema
-- general figuren como lo que son, en vez de quedar como una anomalia silenciosa.
--
-- El esquema general va de $XX.XXX a $XX.XXX por gramo. Habia dos socios aportando
-- muy por debajo de ese piso mientras figuraban catalogados en el nivel mas caro:
--   PAC-XXX — 69 entregas, X.XXX g, $X.XXX.XXX aportados, $X.XXX/g real, nivel 'nuevo'
--   PAC-XXX — 15 entregas,   131 g,   $XXX.XXX aportados, $X.XXX/g real, nivel 'nuevo'
--
-- El nivel 'acuerdo' no lleva un precio unico: el monto se pacta caso por caso y queda
-- asentado en las notas de cada socio. Por eso aporte_por_gramo va en 0, que aca
-- significa "no aplica una tarifa de lista", no "no aporta".

alter table pacientes drop constraint pacientes_nivel_tarifa_check;
alter table pacientes add constraint pacientes_nivel_tarifa_check
  check (nivel_tarifa = any (array['nuevo','antiguo','frecuente','acuerdo']));

alter table ong_tarifas drop constraint ong_tarifas_nivel_check;
alter table ong_tarifas add constraint ong_tarifas_nivel_check
  check (nivel = any (array['nuevo','antiguo','frecuente','acuerdo']));

insert into ong_tarifas (nivel, aporte_por_gramo, vigente_desde, reprocann, notas)
values ('acuerdo', 0, '2025-08-02', null,
  'Aporte pactado individualmente, por fuera del esquema de lista. El monto no es '
  'uniforme: figura en las notas de cada socio y surge de su historial real de aportes. '
  'Registrado el 24/08/2026 a partir de lo ya practicado; pendiente de ratificacion por '
  'el organo directivo.');
