-- Las ultimas 3 dispensas de flor que no tenian variedad, y 2 de sus lotes.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- Despues de `20260821120000_catalogo_geneticas` quedaron 28 dispensas sin
-- genetica. 25 estan bien asi: son 18 de Aceite de Cannabis, 4 de "Programa
-- REPROCANN" (una cuota, no un producto) y 3 sin producto cargado. Ninguna es
-- flor y ninguna tiene variedad que declarar.
--
-- Las otras 3 SI son flor —Flores Tanex, Lemon Candy y Shuga— y quedaron
-- afuera por una razon concreta: no tienen `lote_codigo`, y aquella migracion
-- enganchaba por lote a proposito, para no depender de que dos textos esten
-- escritos igual.
--
-- POR QUE ACA SE LIGA POR NOMBRE. Sin lote no hay otro camino, y el riesgo que
-- el criterio original evitaba no aplica: el catalogo de 22 geneticas se armo
-- desde los LOTES, no desde estos textos, asi que no se esta comparando un
-- texto contra si mismo. Los 3 nombres matchean exacto y contra UNA sola
-- genetica del catalogo (verificado). Si alguno hubiera matcheado dos, o
-- ninguna, quedaba sin ligar.
--
-- EL LOTE SE RECUPERA SOLO DONDE ES INEQUIVOCO. Se exige que haya un unico lote
-- de ese producto elaborado ANTES de la entrega:
--   Lemon Candy (23/11/2025) -> LC-M1411, unico lote del producto.
--   Shuga (29/01/2026)       -> SH-PC260126; el otro lote de Shuga es del
--                               14/02/2026, posterior a la entrega.
--   Flores Tanex (22/10/2025) -> NO se liga: hay tres lotes anteriores a esa
--                               fecha y no hay forma de saber de cual salio.
--
-- LOS 2 g DE LEMON CANDY. LC-M1411 cerraba exacto en 85/85, asi que ligarle
-- esta entrega de 2 g lo pasa a 87 de salida. Se sube la entrada a 87 con el
-- mismo criterio de `20260821140000_cuadrar_lotes_sobregirados`: si salieron
-- 87, entraron al menos 87. La alternativa —dejar el vinculo sin hacer para que
-- el numero no se mueva— seria esconder una entrega que sabemos de que lote
-- salio, que es peor que mover el numero.
--
-- RESULTADO: 1.213 -> 1.216 dispensas con genetica. 1.232 -> 1.234 con lote.
-- LC-M1411 85 -> 87. Lotes sobregirados siguen en 0.
update public.ong_dispensas d
set genetica_id = g.id
from public.geneticas g
where d.genetica_id is null
  and coalesce(d.unidad, 'g') = 'g'
  and d.producto is not null
  and lower(btrim(g.nombre)) = lower(btrim(d.producto))
  and (select count(*) from public.geneticas g2
       where lower(btrim(g2.nombre)) = lower(btrim(d.producto))) = 1;

-- El lote, solo donde hay uno solo anterior a la entrega.
update public.ong_dispensas d
set lote_codigo = l.codigo
from public.ong_lotes l
where d.lote_codigo is null
  and coalesce(d.unidad, 'g') = 'g'
  and d.producto is not null
  and lower(btrim(l.producto)) = lower(btrim(d.producto))
  and l.fecha_elaboracion <= d.fecha
  and (select count(*) from public.ong_lotes l2
       where lower(btrim(l2.producto)) = lower(btrim(d.producto))
         and l2.fecha_elaboracion <= d.fecha) = 1;

-- Y se reconoce la entrada que esa entrega prueba.
update public.ong_lotes l
set gramos_totales = s.salida,
    notas = trim(both ' ' from coalesce(l.notas || ' | ', '')) ||
      'Ajuste 21/08/2026: entrada subida de ' || l.gramos_totales || ' a ' || s.salida ||
      ' al recuperar una dispensa que no tenia lote asignado.'
from (
  select d.lote_codigo, sum(d.gramos) salida
  from public.ong_dispensas d
  where d.lote_codigo is not null
  group by 1
) s
where s.lote_codigo = l.codigo
  and coalesce(l.unidad, 'g') = 'g'
  and s.salida > l.gramos_totales;
