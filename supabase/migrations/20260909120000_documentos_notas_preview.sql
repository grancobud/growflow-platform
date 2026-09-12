-- EL TEXTO DEL PAPEL NO TIENE QUE VIAJAR EN EL LISTADO.
--
-- Medido el 09/09/2026: `ong_documentos` pesa 1.230 kB y se baja entero cada
-- vez que se abre O.N.G. De esos, 950 kB son la columna `notas`, y ahi adentro
-- esta el TEXTO COMPLETO de cada recibo emitido: 846 papeles de unos 1.100
-- caracteres cada uno. Es el 40% de todo lo que baja la pantalla.
--
-- Guardar el texto esta BIEN y no se toca: un documento emitido tiene que poder
-- reimprimirse dentro de dos anos tal como se emitio, no recalculado con los
-- datos de hoy. Lo que esta mal es traerlo para dibujar una lista que muestra
-- sesenta caracteres.
--
-- GENERADA Y NO UN CAMPO QUE ALGUIEN MANTIENE: se actualiza sola con `notas`, y
-- asi no puede desincronizarse. Mismo criterio que el VPD y que la capacidad de
-- las areas: un derivado guardado a mano se desincroniza del dato que lo
-- origino apenas alguien lo corrige.
--
-- 120 caracteres porque el listado corta en 60: alcanza para la primera linea y
-- deja margen para que la UI decida cuanto muestra sin volver a la base.
alter table public.ong_documentos
  add column if not exists notas_preview text
  generated always as (left(notas, 120)) stored;

comment on column public.ong_documentos.notas_preview is
  'Los primeros 120 caracteres de notas, para el listado. Generada: se mantiene sola. El texto completo se pide al abrir el documento.';
