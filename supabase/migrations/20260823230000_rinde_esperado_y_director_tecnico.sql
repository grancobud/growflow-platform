-- El rinde esperado por planta, y quien lo declara.
--
-- La cadena de justificacion no puede juzgar la biomasa sin este numero: con
-- tantas plantas en floracion y tanto rinde por planta se sabe cuanto material
-- puede haber salido del cultivo. Sin el, el eslabon dice «no se puede saber»,
-- que es la verdad pero no sirve para nada.
--
-- LO DECLARA EL DIRECTOR TECNICO DE CULTIVO, que es una figura distinta del
-- Director Medico que la app ya tenia: el medico firma los informes clinicos
-- semestrales de los pacientes, el tecnico responde por el cultivo. Son dos
-- roles y hasta ahora solo estaba modelado uno.
--
-- Queda en NULL a proposito. Un rinde por defecto seria el sistema declarando
-- en nombre del DT algo que solo el puede firmar, y el numero que sale de ahi
-- es el que decide si la biomasa cierra o no.

alter table public.ong_entidad
  add column if not exists rinde_esperado_planta_g numeric,
  add column if not exists director_tecnico        text,
  add column if not exists director_tecnico_matricula text;

comment on column public.ong_entidad.rinde_esperado_planta_g is
  'Gramos que se espera de cada planta en floracion. Lo declara el Director Tecnico de cultivo. NULL = todavia no declarado, y la cadena lo dice en vez de estimarlo.';
comment on column public.ong_entidad.director_tecnico is
  'Director Tecnico de CULTIVO. Distinto del Director Medico, que firma los informes clinicos.';
