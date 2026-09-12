-- Fecha en que la variedad (cultivo actual) paso a floracion. Necesaria para
-- estimar la cosecha de las feminizadas (fotoperiodicas): en vegetativo el tiempo
-- es indefinido; recien al pasar a 12/12 corren los dias de floracion de la ficha.
alter table geneticas add column if not exists inicio_flora date;
