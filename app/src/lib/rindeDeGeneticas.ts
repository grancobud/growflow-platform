// El rinde esperado por planta, sacado de la ficha de cada genética.
//
// El rinde NO es un número de la asociación: es de cada variedad. La ficha de
// Avocado Punch Auto dice «Producción: +145/Planta»; otra genética rinde otra
// cosa. Por eso el dato vive en `geneticas.rendimiento_g`, que ya existía y es
// TEXTO libre —justamente para poder escribir eso—, y hay que leerlo.
//
// De acá sale el número con el que la cadena de justificación decide si la
// biomasa cierra contra las plantas que los socios habilitan.

/** Lo que puede ser un rinde por planta, en gramos. Fuera de esto es un error de carga. */
const MINIMO_RAZONABLE = 1
const MAXIMO_RAZONABLE = 5000

/**
 * Los gramos por planta que declara una ficha, o null si no lo dice.
 *
 * ⚠ LO QUE ESTÁ POR METRO CUADRADO NO SIRVE, y es la trampa de este parseo. Un
 * banco que publica «450 g/m²» no está diciendo cuánto da UNA planta, y tomar
 * ese número como si lo dijera infla el rinde esperado sin que nadie lo note:
 * la biomasa pasaría a «cierra» por un dato que nunca se declaró. Ante la duda
 * se devuelve null, que es lo que hace que la cadena diga «no se puede saber».
 */
export function rindeDeUnaGenetica(texto: string | null | undefined): number | null {
  const t = (texto ?? '').trim().toLowerCase()
  if (!t) return null

  // Por metro cuadrado, por metro, por m2: no es por planta.
  if (/\bm2\b|m²|metro/.test(t)) return null

  // Sin `\b` antes de kg: en «1.5kg» no hay separación entre el 5 y la k, y con
  // el borde de palabra puesto la unidad no se detectaba. Eso hacía leer «1.5kg»
  // como un rinde de 1,5 gramos por planta — mil veces menos, y en silencio.
  const enKilos = /kg|kilo/.test(t)

  // Los números tal como los escribe cualquiera: 145, 1.5, 1,2
  const numeros = (t.match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map(n => parseFloat(n.replace(',', '.')))
    .filter(n => Number.isFinite(n))
  if (numeros.length === 0) return null

  // Un rango se toma por el medio: «120-160» es 140, no 120 ni 160.
  const crudo = numeros.length >= 2
    ? (numeros[0] + numeros[1]) / 2
    : numeros[0]

  const gramos = enKilos ? crudo * 1000 : crudo
  if (gramos < MINIMO_RAZONABLE || gramos > MAXIMO_RAZONABLE) return null
  return Math.round(gramos)
}

/**
 * El rinde promedio por planta EN FLORACIÓN, ponderado por cuántas plantas hay
 * de cada variedad.
 *
 * Ponderado y no promedio simple: si hay treinta plantas de una variedad y una
 * de otra, la de una sola no puede pesar lo mismo. Las plantas cuya genética no
 * declara rinde quedan afuera del cálculo en vez de contar como cero, que
 * hundiría el promedio y haría ver un faltante de biomasa que no existe.
 *
 * Null cuando no se puede saber: sin plantas en floración, o con ninguna
 * genética que declare su rinde.
 */
export function rindePorPlanta(
  plantas: { genetica_id?: string | null; fase?: string | null }[],
  geneticas: { id: string; rendimiento_g?: string | null }[],
): number | null {
  const rindePorId = new Map<string, number>()
  for (const g of geneticas) {
    const r = rindeDeUnaGenetica(g.rendimiento_g)
    if (r != null) rindePorId.set(g.id, r)
  }
  if (rindePorId.size === 0) return null

  let suma = 0
  let cuantas = 0
  for (const p of plantas) {
    if (p.fase !== 'Floracion') continue
    const r = p.genetica_id ? rindePorId.get(p.genetica_id) : undefined
    if (r == null) continue
    suma += r
    cuantas++
  }
  if (cuantas === 0) return null
  return Math.round(suma / cuantas)
}
