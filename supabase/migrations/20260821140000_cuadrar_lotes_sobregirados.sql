-- Cuadra los 12 lotes que entregaron mas de lo que declararon haber recibido.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- !! LEER ANTES: `20260821170000_corregir_la_nota_del_ajuste` corrige una
-- !! afirmacion de este archivo. Abajo dice que "el total declarado era
-- !! imposible". No lo era: `gramos_totales` resulto ser la suma EXACTA de las
-- !! ordenes de compra del lote (77 de 90 lotes de flor coinciden al gramo, y
-- !! ninguno declaraba menos que sus ordenes). Eso se descubrio despues, al
-- !! parsear la cantidad que traen las descripciones de los documentos. Lo que
-- !! este ajuste hace realmente es pasar el total de lo COMPRADO a lo
-- !! ENTREGADO, y con eso el campo deja de decir cuanto se compro.
--
-- DECISION DE GASTON, 21/08/2026. Se le presentaron las dos opciones —dejar el
-- descuadre visible o cerrarlo— y eligio cerrarlo, junto con tratar la
-- diferencia con los cultivadores como deuda real. Queda escrito aca porque el
-- resto del repo dice lo contrario y alguien va a preguntar por que.
--
-- QUE SE AJUSTA Y POR QUE NO ES INVENTAR UN NUMERO
-- 12 lotes de flor tenian `gramos_totales` MENOR que la suma de lo que se
-- dispenso de ellos. El peor: CO-01 (Cookies) declara 550 g de entrada y tiene
-- 719 g entregados en 106 operaciones. Un lote no puede entregar material que
-- no recibio, asi que el total declarado era imposible.
--
-- El ajuste lleva `gramos_totales` a lo efectivamente dispensado. Ese numero NO
-- es una estimacion: es un PISO probado por las salidas. Si salieron 719 g,
-- entraron al menos 719 g. Es el mismo razonamiento con el que se corrigieron
-- las 101 fechas de elaboracion en `20260821100000_fecha_real_de_lotes`: la
-- entrega prueba que el material existia antes.
--
-- Lo que el ajuste NO dice es cuanto entro DE VERDAD. Casi seguro fue mas: 81
-- de los 95 lotes de flor cierran exacto al gramo y solo 2 tienen saldo, que es
-- la firma de ajustar la salida al total del lote en vez de medirla. Y hay 105
-- entregas cobradas sin cantidad por $XX.XXX.XXX, que a las tarifas vigentes
-- son entre 781 y X.XXX g mas que salieron y no estan en ningun lote. Esas NO
-- se tocan: poner una cantidad estimada en una entrega individual si seria
-- inventar, porque ese numero va contra un paciente y contra un lote.
--
-- LA TRAZA QUEDA EN EL PROPIO DATO. Cada lote ajustado se lleva en `notas` de
-- cuanto a cuanto se subio. El descuadre deja de aparecer como error en
-- Coherencia, pero no se borra: queda escrito en la fila que se toco.
--
-- EFECTO COLATERAL MEDIDO. `costo_por_gramo` es por unidad de medida, asi que
-- subir la cantidad sube lo invertido en mercaderia en $X.XXX.XXX (de
-- $XX.XXX.XXX a $XX.XXX.XXX en estos 12 lotes). Eso mueve el total "invertido"
-- del catalogo, en `portal.ts`.
--
-- LO QUE NO SE MUEVE: la deuda con proveedores. `v_saldo_proveedores` se calcula
-- sobre `ong_documentos`, que esta migracion no toca, asi que sigue en
-- $XX.XXX.XXX,XX. Los $X.XXX.XXX de material que este ajuste reconoce no tienen
-- documento de compra: son material sin origen documentado, no una deuda
-- registrada. Que la deuda NO suba es justamente la senal de eso.
--
-- RESULTADO: 337 g sumados en 12 lotes. Lotes sobregirados 12 -> 0.
update public.ong_lotes l
set gramos_totales = s.salida,
    notas = trim(both ' ' from coalesce(l.notas || ' | ', '')) ||
      'Ajuste 21/08/2026: entrada subida de ' || l.gramos_totales || ' a ' || s.salida ||
      ' (+' || (s.salida - l.gramos_totales) || ') porque se dispensaron ' || s.salida ||
      ' de un lote declarado de ' || l.gramos_totales || '. Es el piso probado por las salidas, no una medicion del ingreso.'
from (
  select d.lote_codigo, sum(d.gramos) salida
  from public.ong_dispensas d
  where d.lote_codigo is not null
  group by 1
) s
where s.lote_codigo = l.codigo
  and coalesce(l.unidad, 'g') = 'g'
  and s.salida > l.gramos_totales;
