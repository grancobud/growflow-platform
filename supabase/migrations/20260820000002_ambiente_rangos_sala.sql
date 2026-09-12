-- Rangos de ambiente por sala (B4 de la orden de trabajo).
--
-- Hasta ahora el semaforo comparaba siempre contra `RANGOS[etapa]`, una
-- constante de app/src/lib/ambiente.ts sacada de la bibliografia de indoor. Con
-- eso, 27 C en vegetativo da verde — y el target real de la asociación es 24-26. Una
-- constante del codigo no puede saber a que apunta cada sala.
--
-- Las seis columnas son NULLABLE a proposito: null = "usa el rango de la etapa".
-- Asi una sala recien creada se comporta igual que antes, y quien quiera afinar
-- toca solo el limite que le importa sin tener que redefinir los seis.
--
-- No se guarda el rango de VPD derivado de temp/humedad: el VPD tiene su propio
-- par porque su rango util no se deduce de los otros dos (mismo criterio por el
-- que el VPD medido se calcula y no se guarda).

alter table public.ambiente_salas
  add column if not exists temp_min numeric(5,2) check (temp_min is null or temp_min between -10 and 60),
  add column if not exists temp_max numeric(5,2) check (temp_max is null or temp_max between -10 and 60),
  add column if not exists hum_min  numeric(5,2) check (hum_min  is null or hum_min  between 0 and 100),
  add column if not exists hum_max  numeric(5,2) check (hum_max  is null or hum_max  between 0 and 100),
  add column if not exists vpd_min  numeric(4,2) check (vpd_min  is null or vpd_min  between 0 and 6),
  add column if not exists vpd_max  numeric(4,2) check (vpd_max  is null or vpd_max  between 0 and 6);

-- Un minimo por encima del maximo deja el semaforo en rojo permanente sin que
-- se entienda por que. Se rechaza en la base y no solo en el formulario: la
-- Edge Function `ingesta` y el SQL a mano no pasan por el formulario.
alter table public.ambiente_salas
  drop constraint if exists ambiente_salas_rangos_coherentes;
alter table public.ambiente_salas
  add constraint ambiente_salas_rangos_coherentes check (
    (temp_min is null or temp_max is null or temp_min < temp_max) and
    (hum_min  is null or hum_max  is null or hum_min  < hum_max)  and
    (vpd_min  is null or vpd_max  is null or vpd_min  < vpd_max)
  );

comment on column public.ambiente_salas.temp_min is
  'Null = usa el rango de la etapa (RANGOS en app/src/lib/ambiente.ts).';
