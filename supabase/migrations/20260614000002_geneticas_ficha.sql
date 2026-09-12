-- Ficha ampliada de genetica: campos relevantes para cultivo medicinal.
-- No rompe datos existentes (todas las columnas son opcionales).

alter table geneticas add column if not exists genotipo text;          -- Indica / Sativa / Hibrida / Ruderalis
alter table geneticas add column if not exists indica_pct int;         -- % dominancia indica
alter table geneticas add column if not exists sativa_pct int;         -- % dominancia sativa
alter table geneticas add column if not exists linaje text;            -- cruza / padres geneticos
alter table geneticas add column if not exists tiempo_vege_dias int;   -- dias recomendados de vege
alter table geneticas add column if not exists altura text;            -- Baja / Media / Alta
alter table geneticas add column if not exists rendimiento_g text;     -- g/planta o g/m2
alter table geneticas add column if not exists dificultad text;        -- Facil / Media / Dificil
alter table geneticas add column if not exists terpenos text;          -- perfil aromatico
alter table geneticas add column if not exists efectos text;           -- relajante / euforico / etc
alter table geneticas add column if not exists usos_medicinales text;  -- dolor / insomnio / ansiedad...
alter table geneticas add column if not exists ambiente text;          -- Indoor / Outdoor / Invernadero
alter table geneticas add column if not exists resistencia text;       -- hongos / plagas
alter table geneticas add column if not exists stretch text;           -- estiramiento en flora
alter table geneticas add column if not exists foto_url text;          -- imagen de la genetica
alter table geneticas add column if not exists color text;             -- color de identificacion en la app
