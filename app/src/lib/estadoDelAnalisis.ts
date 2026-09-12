// Qué lote tiene su análisis de laboratorio, y cuál entró antes de que se
// pidiera.
//
// EL PROBLEMA
//
// Al 23/08/2026 los 101 lotes de la asociación estaban sin análisis, y el eslabón de
// biomasa quedaba en rojo. Exigírselo a todos deja la cadena rota para siempre:
// un análisis no se puede hacer sobre material que ya se entregó y se consumió.
//
// Es el mismo caso que el mandato —un requisito que empezó a pedirse en algún
// momento— y se resuelve igual: hay una fecha desde la cual se exige, y lo
// anterior lleva su constancia, con la fecha en que ese lote entró. No se
// inventa nada: esa fecha ya está cargada en el lote.
//
// POR QUÉ IMPORTA EL ANÁLISIS, para que la constancia no se lea como un permiso
// permanente: el material que no salió del cultivo propio no está justificado
// por las plantas de los socios. Lo que lo respalda es de quién vino y qué tiene
// adentro. Sin análisis, de un lote comprado sólo se sabe lo que dijo el que lo
// vendió.

/**
 * Desde cuándo se pide el análisis a cada lote que entra.
 *
 * ⚠ Cambiar esta fecha cambia a qué lotes ampara la constancia. Es una decisión
 * explícita, no un número para ajustar hasta que la pantalla se ponga verde.
 */
export const ANALISIS_EXIGIBLE_DESDE = '2026-08-23'

export type EstadoAnalisis =
  /** El análisis está archivado. */
  | 'tiene'
  /** Entró antes de que se pidiera: hay que regularizarlo, pero no está en falta. */
  | 'anterior_al_requisito'
  /** Entró con el requisito vigente y no lo tiene. */
  | 'falta'

type Lote = { analisis_path?: string | null; fecha_elaboracion?: string | null }

export function estadoDelAnalisis(l: Lote): EstadoAnalisis {
  if (l.analisis_path) return 'tiene'
  // Sin fecha de ingreso NO se da por anterior: sería regalarle la excusa a
  // cualquier lote cargado hoy al que le falte la fecha.
  if (l.fecha_elaboracion && l.fecha_elaboracion < ANALISIS_EXIGIBLE_DESDE) {
    return 'anterior_al_requisito'
  }
  return 'falta'
}

/**
 * Por qué ese lote no tiene análisis, cuando entró antes de que se pidiera.
 *
 * Lleva la fecha de ESE lote: no es una excusa general, es un hecho suyo.
 */
export function leyendaDelAnalisis(l: Lote): string | null {
  if (estadoDelAnalisis(l) !== 'anterior_al_requisito') return null
  return `Ingresó el ${l.fecha_elaboracion}, cuando el análisis de laboratorio todavía no `
    + 'se requería para los lotes que entran. Queda pendiente de regularizar.'
}
