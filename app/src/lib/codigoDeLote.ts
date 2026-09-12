// El próximo código de lote libre.
//
// El código de lote NO es una etiqueta: es la clave con la que el material se
// engancha al resto del sistema. `ong_dispensas` no guarda `lote_id` —guarda
// `lote_codigo` como texto— y ese mismo código viaja al recibo, a la constancia
// de traslado y al informe médico.
//
// Por eso acá se es más estricto que en `numeroDeOrden.ts`, que es el hermano de
// este archivo: allá un número repetido afea un listado, acá descuenta stock del
// lote equivocado y ensucia un documento legal. Aquel SUGIERE y deja repetir con
// aviso, porque el número puede venir impuesto por el proveedor. Este sugiere
// igual, pero el repetido no se guarda.
//
// El formato lo eligió la asociación: correlativo global, sin fecha adentro. Un
// contador que nunca reinicia no puede colisionar, y no depende de que la fecha
// que alguien tipeó sea la correcta.

/** El formato `LOTE-<n>`. Se aceptan los ceros a la izquierda al leer. */
const FORMATO = /^LOTE-(\d+)$/i

/** Con cuántos dígitos se escribe el número. `LOTE-001`. */
const ANCHO = 3

/** Un lote, visto por lo único que a este archivo le importa. */
export interface LoteConCodigo {
  id?: string
  codigo?: string | null
}

/** Igual que lo compara una persona: sin espacios de más y sin importar el caso. */
const normalizar = (c: string | null | undefined): string =>
  String(c ?? '').trim().toUpperCase()

/**
 * El siguiente `LOTE-nnn` libre, mirando los códigos ya usados.
 *
 * Devuelve `LOTE-001` cuando todavía no hay ninguno, que es el caso de Chaco al
 * momento de escribir esto: 0 lotes, la serie empieza limpia.
 *
 * ⚠ Los códigos que NO siguen el formato se ignoran para el cálculo pero **no se
 * pierden**: siguen siendo el código de su lote. la asociación tiene 101 así —
 * `#1COOP2526`, `A-PR25726`, `Cafe-L01`— que vinieron de la planilla y nadie va
 * a renumerar. Si alguna vez se porta esto allá, la serie nueva arranca en
 * `LOTE-001` y convive con los viejos sin tocarlos.
 */
export function proximoCodigoDeLote(codigos: (string | null | undefined)[]): string {
  let mayor = 0
  for (const c of codigos) {
    const m = FORMATO.exec(normalizar(c))
    if (m) mayor = Math.max(mayor, Number(m[1]))
  }
  return `LOTE-${String(mayor + 1).padStart(ANCHO, '0')}`
}

/**
 * Si ese código ya lo está usando OTRO lote.
 *
 * `idPropio` es el lote que se está editando: sin eso, guardar un lote sin
 * cambiarle el código se leería como un duplicado de sí mismo.
 */
export function codigoRepetido(
  codigo: string | null | undefined,
  lotes: LoteConCodigo[],
  idPropio?: string,
): boolean {
  const c = normalizar(codigo)
  if (!c) return false
  return lotes.some(l => l.id !== idPropio && normalizar(l.codigo) === c)
}

/**
 * El lote que ya usa ese código, para poder nombrarlo en el aviso.
 *
 * Decir «ese código ya existe» obliga a ir a buscar cuál. Devolver el lote deja
 * escribir «ya lo usa el lote que cargaste el martes».
 */
export function loteQueUsaElCodigo<T extends LoteConCodigo>(
  codigo: string | null | undefined,
  lotes: T[],
  idPropio?: string,
): T | undefined {
  const c = normalizar(codigo)
  if (!c) return undefined
  return lotes.find(l => l.id !== idPropio && normalizar(l.codigo) === c)
}

/**
 * Si el código de este lote ya NO se puede tocar.
 *
 * El riesgo no existe mientras nada apunte al lote: ahí un código mal tipeado se
 * corrige y listo. Apenas hay una reserva o una entrega, renombrarlo rompe el
 * vínculo **en silencio** —el join es por texto— así que el campo se cierra.
 *
 * Es la misma regla que ya usa el borrado en `Catalogo.tsx`, que no deja borrar
 * un lote con reservas y manda a desactivarlo.
 */
export function codigoBloqueado(
  lote: LoteConCodigo,
  pedidos: { lote_id?: string | null }[],
  dispensas: { lote_codigo?: string | null }[],
): boolean {
  if (!lote.id) return false
  const c = normalizar(lote.codigo)
  return pedidos.some(p => p.lote_id === lote.id)
    || (!!c && dispensas.some(d => normalizar(d.lote_codigo) === c))
}
