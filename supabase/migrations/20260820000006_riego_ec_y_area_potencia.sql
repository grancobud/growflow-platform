-- B3 (EC del riego) y B5 (potencia del area) de la orden de trabajo.
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- B3 -- `riegos` guardaba `ppm` y nada mas. Dos problemas:
--
--   1. Un ppm sin factor de conversion no significa nada. Los medidores baratos
--      leen EC (mS/cm) y muestran ppm multiplicando por 500 o por 700 segun la
--      marca. "600 ppm" es EC 1,2 con factor 500 y EC 0,857 con factor 700: son
--      soluciones distintas. El fertirriego del Proyecto Demo del 16/08 se
--      anoto como "EC 1,2 = 600 ppm con factor 500" justamente por eso.
--   2. la asociación mide en EC, no en ppm. Obligar a convertir a mano antes de cargar
--      es pedir que alguien haga una cuenta que la computadora puede hacer.
--
-- Se guardan los dos y el factor: se conserva lo que se midio en vez de un
-- derivado, y el otro valor se calcula. Mismo criterio que el VPD en ambiente.
--
-- B5 -- `cultivo_areas` no tenia potencia. Econometria tiene las categorias
-- "Luz (consumo)" y "Luz (abono)" pero el costo se carga a mano por ciclo: no
-- hay forma de saber cuanto consume cada area, ni de repartir la factura entre
-- ellas. Con los watts instalados y las horas de luz, el consumo sale solo.

alter table public.riegos
  add column if not exists ec numeric(5,2)
    check (ec is null or (ec >= 0 and ec <= 20)),
  add column if not exists ppm_factor int not null default 500
    check (ppm_factor in (500, 700));

comment on column public.riegos.ec is
  'Conductividad en mS/cm. Es lo que mide el instrumento; el ppm se deriva multiplicando por ppm_factor.';
comment on column public.riegos.ppm_factor is
  'Factor del medidor: 500 (Hanna/EEUU) o 700 (Truncheon/EU). Sin esto un ppm no se puede interpretar.';

-- Backfill: los riegos que ya tienen ppm cargado se completan con el EC que les
-- corresponde segun el factor por defecto. No se inventa nada — es la misma
-- lectura expresada en la otra unidad.
update public.riegos
   set ec = round((ppm::numeric / 500), 2)
 where ppm is not null and ppm > 0 and ec is null;

alter table public.cultivo_areas
  add column if not exists watts int
    check (watts is null or (watts >= 0 and watts <= 100000)),
  add column if not exists horas_luz numeric(4,1)
    check (horas_luz is null or (horas_luz >= 0 and horas_luz <= 24));

comment on column public.cultivo_areas.watts is
  'Potencia de iluminacion instalada en el area. Null = sin cargar, no cero.';
comment on column public.cultivo_areas.horas_luz is
  'Horas de luz por dia. Con watts alcanza para estimar el consumo diario del area.';
