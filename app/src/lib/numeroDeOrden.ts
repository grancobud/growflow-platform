// El próximo número de orden de servicio libre.
//
// El número lo elige la persona y no puede repetirse: los pagos se ligan a la
// orden POR EL NÚMERO, así que con uno repetido no se puede saber a cuál se le
// pagó y el saldo del proveedor sale mal en cuanto alguna reciba un pago.
//
// Eso ya pasó: OS38 quedó cargado dos veces, con fechas y montos distintos, y se
// descubrió meses después en un cruce. Elegir a ojo el siguiente número mirando
// una lista de setecientos comprobantes es exactamente el trabajo que una
// máquina hace sin equivocarse.
//
// No se numera solo ni se bloquea el campo: el número puede venir impuesto por
// el proveedor o por una serie que la asociación ya usaba en papel. Se sugiere,
// y quien carga decide.

/** El formato `OS<n>`, que es el que usa la asociación. */
const FORMATO = /^OS(\d+)$/i

/**
 * El siguiente `OS<n>` libre, mirando los números ya usados POR LOS GASTOS.
 *
 * Devuelve `OS1` cuando todavía no hay ninguno. Los números que no siguen el
 * formato —`OS38-B`, o cualquier serie ajena— se ignoran para el cálculo pero
 * NO se pierden: siguen existiendo como número de su documento.
 *
 * ⚠️ RECIBE LOS DOCUMENTOS, NO SUS NÚMEROS, Y ESO ES EL ARREGLO.
 *
 * Antes recibía una lista de strings y el llamador le pasaba TODOS los
 * documentos, emitidos incluidos. la asociación lo detectó el 04/09/2026 con la frase
 * exacta: «registré dispensas de prueba y la app les asignó OSxxx, cuando en el
 * sistema que veníamos usando las OSxxx las usamos para ingresar lotes al
 * stock».
 *
 * `OS` es la serie de las ÓRDENES DE SERVICIO: cada número identifica el
 * ingreso de un lote y es la clave por la que se le imputan los pagos. Un
 * comprobante de dispensa que toma un `OS` hace dos daños: se queda con un
 * número que le pertenece a una orden, y CORRE LA SERIE —el siguiente ingreso
 * real recibe el número de más adelante—.
 *
 * Ya había pasado tres veces cuando se encontró: OS116, OS119 y OS120 quedaron
 * en comprobantes de dispensa, y son justo los que el Sistema de Gestión usa
 * para los ingresos de los lotes del 29/08. Por eso esos lotes figuraban sin
 * orden que los respalde: no faltaba cargarlas, su número estaba tomado.
 *
 * Tomando los documentos enteros la función puede filtrar sola, y no hay forma
 * de llamarla mal desde otra pantalla.
 */
export function proximoNumeroDeOrden(
  documentos: { tipo?: string | null; numero?: string | null }[],
): string {
  let mayor = 0
  for (const d of documentos) {
    if (d.tipo !== 'gasto') continue
    const m = FORMATO.exec(String(d.numero ?? '').trim())
    if (m) mayor = Math.max(mayor, Number(m[1]))
  }
  return `OS${mayor + 1}`
}

/** Si ese número ya está usado por otro documento. */
export function numeroRepetido(
  numero: string | null | undefined,
  documentos: { id?: string; numero?: string | null }[],
  idPropio?: string,
): boolean {
  const n = String(numero ?? '').trim().toLowerCase()
  if (!n) return false
  return documentos.some(d =>
    d.id !== idPropio && String(d.numero ?? '').trim().toLowerCase() === n)
}
