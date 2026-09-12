// Qué lote propio está trazado hasta su cosecha, y cuál entró antes de que se
// pidiera esa cadena.
//
// EL PROBLEMA
//
// Al 30/08/2026 la asociación tenía 30 lotes por X.XXX g marcados
// `propio_sin_cosecha`: material de la asociación que entró sin una cosecha
// registrada que lo respalde. Contra 2 lotes por 100 g que sí la tienen.
//
// «Este material es de ustedes, ¿de qué planta salió?» es la primera pregunta
// de una inspección, y para esos 30 lotes hoy no hay respuesta. Pero exigirla
// hacia atrás deja el eslabón en rojo para siempre: la cosecha de un material
// que ya se entregó y se consumió no se puede registrar después sin inventar de
// qué plantas salió, cuántos gramos dio cada una y qué día se cortaron.
//
// Es el mismo caso que el análisis y que el mandato —un requisito que empezó a
// pedirse en algún momento— y se resuelve igual: hay una fecha desde la cual se
// exige, y lo anterior lleva su constancia con la fecha de elaboración de ESE
// lote. No se inventa nada: esa fecha ya está cargada.
//
// Que el corte no se lea como una amnistía: los 30 lotes van hasta el
// 21/08/2026 y los 2 que sí están trazados son del 27/08. O sea que desde que
// el requisito rige se viene cumpliendo, y lo que ampara la constancia es
// exactamente lo que ya no se puede reconstruir.
//
// POR QUÉ IMPORTA EL ORIGEN, para que la constancia no se lea como un permiso
// permanente: lo que justifica que esto sea cultivo por cuenta de los socios y
// no compra y reventa es poder mostrar la planta detrás de cada gramo. Un lote
// propio sin cosecha es un gramo que la asociación dice haber cultivado y no
// puede probar.

/**
 * Desde cuándo se le pide a cada lote propio la cosecha que lo respalda.
 *
 * Es la misma fecha que `ANALISIS_EXIGIBLE_DESDE` y `MANDATO_EXIGIBLE_DESDE`:
 * son un solo paquete de trazabilidad adoptado el mismo día, y tres fechas
 * distintas para lo mismo sólo darían tres discusiones distintas.
 *
 * ⚠ Cambiar esta fecha cambia a qué lotes ampara la constancia. Es una decisión
 * explícita, no un número para ajustar hasta que la pantalla se ponga verde.
 */
export const ORIGEN_EXIGIBLE_DESDE = '2026-08-23'

export type EstadoOrigen =
  /** No es material propio, o su cosecha está registrada. */
  | 'trazado'
  /** Entró antes de que se pidiera: hay que regularizarlo, pero no está en falta. */
  | 'anterior_al_requisito'
  /** Entró con el requisito vigente y sigue sin cosecha. */
  | 'falta'

type Lote = {
  origen?: string | null
  cosecha_id?: string | null
  fecha_elaboracion?: string | null
}

export function estadoDelOrigen(l: Lote): EstadoOrigen {
  // Sólo se le pide la cadena al material que la asociación dice haber
  // cultivado. Lo comprado se respalda con el proveedor y el análisis, que es
  // lo que miran `loteEsComprado` y `estadoDelAnalisis`.
  if (l.origen !== 'propio_sin_cosecha') return 'trazado'
  // Sin fecha de elaboración NO se da por anterior: sería regalarle la excusa a
  // cualquier lote cargado hoy al que le falte la fecha. Misma regla que en
  // `estadoDelAnalisis`.
  const f = (l.fecha_elaboracion ?? '').slice(0, 10)
  if (f && f < ORIGEN_EXIGIBLE_DESDE) return 'anterior_al_requisito'
  return 'falta'
}

/**
 * Por qué ese lote propio no tiene cosecha, cuando entró antes de que se
 * pidiera.
 *
 * Lleva la fecha de ESE lote: no es una excusa general, es un hecho suyo.
 */
export function leyendaDelOrigen(l: Lote): string | null {
  if (estadoDelOrigen(l) !== 'anterior_al_requisito') return null
  return `Entró el ${l.fecha_elaboracion}, cuando todavía no se le pedía a cada lote propio `
    + 'la cosecha que lo respalda. Queda pendiente de regularizar: la cosecha de un material '
    + 'que ya se entregó no se puede reconstruir sin inventar de qué plantas salió.'
}
