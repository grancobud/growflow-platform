-- pH y EC del DRENAJE (extension de B3).
--
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- `riegos` guardaba `escurrido_ml` —cuanto salio— pero no QUE salio. En
-- sustrato, el pH y el EC del drenaje son la medicion mas diagnostica que hay:
-- comparados contra los del riego dicen si se estan acumulando sales.
--
-- El caso que lo destapo es del 20/08/2026, del cultivador:
--   riego al organico   -> EC 0.24 (120 ppm), pH 6.5
--   drenaje recuperado  -> 300 cc, pH 5.8, EC 2.03 (1020 ppm)
--
-- El drenaje sale con OCHO VECES el EC del riego. Ese salto es todo el dato: sin
-- las dos lecturas no se ve, y guardar solo el volumen lo perdia. De paso, sus
-- numeros confirman el factor del medidor: 1020 / 2.03 = 502, o sea 500.

alter table public.riegos
  add column if not exists escurrido_ph numeric(4,2)
    check (escurrido_ph is null or (escurrido_ph >= 0 and escurrido_ph <= 14)),
  add column if not exists escurrido_ec numeric(5,2)
    check (escurrido_ec is null or (escurrido_ec >= 0 and escurrido_ec <= 20)),
  add column if not exists escurrido_ppm int
    check (escurrido_ppm is null or (escurrido_ppm >= 0 and escurrido_ppm <= 20000));

comment on column public.riegos.escurrido_ec is
  'EC del drenaje en mS/cm. Contra `ec` (la del riego) dice si el sustrato acumula sales: mucho mas alto = hay que lavar.';
comment on column public.riegos.escurrido_ph is
  'pH del drenaje. Contra `ph` dice como esta amortiguando el sustrato.';
