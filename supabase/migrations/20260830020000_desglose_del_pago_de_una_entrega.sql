-- El desglose del pago de una entrega, por medio.
--
-- POR QUÉ
--
-- El modelo tenía UN `medio_pago` por entrega y la realidad tiene pagos
-- partidos. En la asociación eso dejó 158 asientos de caja por $X.XXX.XXX con el
-- concepto «Dispensa a PAC-xxx» y `dispensa_id` en null: casi siempre de a dos,
-- porque son el desglose —efectivo tanto, transferencia tanto— de entregas que
-- ADEMÁS quedaron cargadas con su total como «Mixto».
--
-- Caso verificado: PAC-XXX del 03/08. Una entrega de $XX.XXX, su asiento de
-- $XX.XXX «Mixto», y encima dos sueltos de $XX.XXX y $XX.XXX. La caja cuenta
-- $XXX.XXX por una entrega de $XX.XXX.
--
-- «Mixto» decía que el pago fue con dos medios sin decir cuánto de cada uno, y
-- por eso el arqueo no podía separarlos: $X.XXX.XXX quedaban «sin discriminar»
-- sobre 1.827 asientos, y el efectivo daba −$X.XXX.XXX, que es un número
-- imposible — no se pueden sacar más billetes de los que entraron.
--
-- QUÉ FORMA TIENE
--
-- `{"Efectivo": 75000, "Transferencia": 15000}`. Cuando está cargado, `aporte`
-- es la suma de sus valores y `medio_pago` queda en 'Mixto'. Del lado de la app,
-- `cobrosDeEntrega` es el único lugar que lo lee, y `asientoDeEntrega` escribe
-- UN asiento por medio, cada uno atado a la entrega.
--
-- jsonb y no dos columnas fijas: los medios de pago son cinco (Efectivo,
-- Transferencia, Mixto, Billetera virtual, Otro) y mañana pueden ser otros. Dos
-- columnas obligarían a una migración por cada medio nuevo.
--
-- NO ARREGLA LOS DATOS VIEJOS. Es aditiva y nullable: las 1.241 entregas
-- existentes siguen exactamente igual, con su `medio_pago` simple. Los 158
-- asientos sueltos quedan donde están y los marca el cruce de Coherencia
-- «Asientos sueltos en la caja», porque limpiarlos requiere decidir caso por
-- caso —con dos entregas del mismo paciente el mismo día no hay forma de saber
-- cuál es la dueña del pago— y adivinar sobre plata es peor que dejarlo visible.

alter table ong_dispensas
  add column if not exists aporte_desglose jsonb;

comment on column ong_dispensas.aporte_desglose is
  'Desglose del reembolso por medio de pago, ej {"Efectivo":75000,"Transferencia":15000}. Null = pago con un solo medio (ver medio_pago). Cuando está cargado, aporte = suma de sus valores.';
