-- Corrige lo que dice la nota del ajuste en los 13 lotes tocados.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- `20260821140000_cuadrar_lotes_sobregirados` dejo escrito en 12 lotes que "el
-- total anterior era imposible". ESO ES FALSO y hay que sacarlo de la base.
--
-- Cuando se hizo ese ajuste no se habia mirado todavia la descripcion de los
-- documentos de compra, que trae la cantidad: "Cookies · lote CO-01 · 191 gr/ud
-- a $8000 c/u". Parseando los 117 documentos que la traen aparece que
-- `gramos_totales` NO era un numero flojo: era la suma exacta de las ordenes de
-- compra del lote. En 77 de los 90 lotes de flor con documento coincide al
-- gramo, y en NINGUNO el lote declaraba menos que sus ordenes.
--
-- CO-01 es el caso claro: 15 ordenes de compra que suman 550 g y $X.XXX.XXX, o
-- sea 550 x $X.XXX exacto. El 550 estaba bien. Lo que no cierra es que de ese
-- lote salieron 719 g.
--
-- LO QUE ESTO CAMBIA. El ajuste no "reconocio una entrada mal medida": paso el
-- total de lo comprado a lo entregado, y con eso el lote dejo de decir cuanto
-- se compro. La diferencia sigue existiendo —339 g repartidos en 13 lotes que
-- salieron sin orden de compra que los respalde— pero ya no se ve mirando el
-- lote. Por eso la nota tiene que decirlo: es el unico lugar donde queda.
--
-- No se revierte el ajuste porque la decision de cerrarlo fue de Gaston y sigue
-- siendo suya. Lo que se corrige es la razon escrita, que era mia y estaba mal.
update public.ong_lotes l
set notas = regexp_replace(
      l.notas,
      'Ajuste 21/08/2026: entrada subida de ([0-9.]+) a ([0-9.]+)[^|]*',
      'Ajuste 21/08/2026: entrada subida de \1 a \2. OJO: el \1 NO estaba mal. '
      || 'Era la suma exacta de las ordenes de compra de este lote. El ajuste lo '
      || 'llevo a lo entregado para cerrar el stock, asi que este campo ya NO dice '
      || 'cuanto se compro. La diferencia son gramos que salieron sin orden de '
      || 'compra que los respalde.')
where l.notas like '%Ajuste 21/08/2026%';
