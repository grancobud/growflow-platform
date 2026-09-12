// Las curvas y las duraciones del movimiento, en un solo lugar.
//
// POR QUE EXISTE
//
// La misma curva —`[0.22, 1, 0.36, 1]`— estaba escrita a mano en ONCE archivos,
// y las duraciones eran CATORCE valores distintos: 0.2, 0.25, 0.28, 0.3, 0.32,
// 0.35, 0.36, 0.4, 0.45, 0.5, 0.6, 1.0… Entre 0.35 y 0.36 no hay diferencia que
// nadie perciba; lo que hay es la imposibilidad de cambiar el ritmo de la app
// sin buscar y reemplazar en veinte archivos.
//
// Tres duraciones alcanzan. Si una pantalla necesita una cuarta, casi siempre es
// que está animando algo que no debería.

/**
 * La curva de entrada y salida.
 *
 * Es un ease-out fuerte: arranca rápido y frena al final. Las curvas de fábrica
 * son demasiado débiles y se sienten flojas; `ease-in` está prohibido en UI
 * porque demora el primer frame, que es justo el que la persona está mirando.
 */
export const EASE = [0.22, 1, 0.36, 1] as const

/** La misma curva, para CSS. */
export const EASE_CSS = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Cuánto dura cada cosa, en segundos (que es como los toma framer-motion).
 *
 * El techo es 300 ms y no es una preferencia: por encima de eso la interfaz
 * empieza a sentirse lenta aunque el trabajo real tarde lo mismo. Una pantalla
 * que entra en 180 ms se percibe más rápida que la misma en 400.
 */
export const DURACION = {
  /** Presión de botón, cambio de color. Lo que confirma un toque. */
  toque: 0.1,
  /** Entrada de un panel, una tarjeta, una fila. El caso normal. */
  entrada: 0.2,
  /** Una pantalla entera o un modal: lo más lento que se permite. */
  pantalla: 0.28,
} as const

/**
 * El escalonado de una lista que entra.
 *
 * Sólo para listas CORTAS y que se ven poco. En una lista de sesenta plantas
 * —que se abre varias veces por día— escalonar convierte la entrada en una
 * espera: la última fila aparecería casi tres segundos después de la primera.
 */
export const STAGGER = 0.04
