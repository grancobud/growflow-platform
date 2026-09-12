// Qué entrega dice de qué lote salió el material, y cuál es anterior a que se
// pidiera.
//
// EL PROBLEMA
//
// El lote es lo que une la entrega con el cultivo: sin él, la trazabilidad se
// corta justo en el último paso, que es el único que le importa al paciente y
// el que una inspección puede verificar contra el estante.
//
// Al 30/08/2026 la asociación tenía 8 entregas de 1.248 sin lote. Siete vienen de la
// planilla vieja —cargadas el 20/08/2026, con fechas de 2025 y principios de
// 2026— y una es del 24/08/2026, o sea posterior al requisito. Esa sí está en
// falta, y es la prueba de que el corte no es una amnistía: si lo fuera, no
// marcaría ninguna.
//
// Reconstruir el lote de una entrega vieja significa elegir, entre los lotes
// que había ese día, uno cualquiera. Eso no es trazar: es fabricar la
// trazabilidad, que es peor que no tenerla, porque el papel dice que el
// material salió de una planta que quizá no lo dio.
//
// POR QUÉ IMPORTA EL LOTE, para que la constancia no se lea como un permiso
// permanente: si mañana un lote sale mal, el lote es lo único que dice a quién
// hay que avisar.

/**
 * Desde cuándo se le pide el lote a cada entrega.
 *
 * Misma fecha que `ORIGEN_EXIGIBLE_DESDE` y `ANALISIS_EXIGIBLE_DESDE`: es el
 * mismo paquete de trazabilidad, adoptado el mismo día.
 *
 * ⚠ Cambiar esta fecha cambia a qué entregas ampara la constancia. Es una
 * decisión explícita, no un número para ajustar hasta que la pantalla se ponga
 * verde.
 */
export const LOTE_EXIGIBLE_DESDE = '2026-08-23'

export type EstadoLoteEntregado =
  /** La entrega dice de qué lote salió. */
  | 'tiene'
  /** Es anterior al requisito: no está en falta, pero se dice. */
  | 'anterior_al_requisito'
  /** Entrega posterior al requisito y sin lote. Eso sí es una deuda. */
  | 'falta'

type Entrega = { fecha?: string | null; lote_codigo?: string | null }

export function estadoDelLoteEntregado(d: Entrega): EstadoLoteEntregado {
  if (String(d.lote_codigo ?? '').trim() !== '') return 'tiene'
  // Sin fecha no se puede saber si es anterior, y una entrega sin fecha ya es
  // un problema por su cuenta: no se le regala la constancia.
  const f = (d.fecha ?? '').slice(0, 10)
  if (!f) return 'falta'
  return f < LOTE_EXIGIBLE_DESDE ? 'anterior_al_requisito' : 'falta'
}

/** La leyenda que acompaña a una entrega anterior al requisito. */
export function leyendaDelLoteEntregado(d: Entrega): string | null {
  if (estadoDelLoteEntregado(d) !== 'anterior_al_requisito') return null
  return `Entrega del ${(d.fecha ?? '').slice(0, 10) || 'sin fecha'}, anterior al `
    + `${LOTE_EXIGIBLE_DESDE}, que es desde cuando se registra de qué lote sale cada entrega. `
    + 'No está en falta: elegir ahora uno de los lotes que había ese día no sería trazarla, '
    + 'sería fabricarle un origen.'
}
