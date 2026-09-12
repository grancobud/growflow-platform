// Qué entrega tiene su reporte de seguimiento, y cuál es anterior a que se pidiera.
//
// EL PROBLEMA
//
// Al 24/08/2026 había 911 entregas a pacientes, 108 personas, y CERO reportes de
// seguimiento cargados. El circuito estaba entero —la encuesta, el bloqueo RN-05,
// el informe del Director Médico— pero nunca se había usado.
//
// Eso deja el portal inutilizable: RN-05 bloquea el catálogo de quien tiene su
// última entrega sin reporte, o sea de las 108. La primera persona que entre a
// pedir se choca con un error que no puede resolver, porque el reporte que le
// falta es de una entrega de hace meses que nadie le preguntó.
//
// LO QUE NO SE HACE
//
// Rellenar los reportes. Un reporte dice cuánto alivio dio del 1 al 5 y QUÉ
// EFECTOS ADVERSOS hubo, y termina en el informe semestral que firma el Director
// Médico y se presenta ante la autoridad sanitaria. Inventarlo es fabricar la
// evolución clínica de 108 personas y hacer que un médico firme con su matrícula
// algo que nadie reportó. Si alguien tuvo un efecto adverso, el registro diría lo
// contrario.
//
// LO QUE SE HACE
//
// Lo mismo que con el mandato y con el análisis de los lotes: hay una fecha desde
// la cual el reporte se exige, y lo anterior lleva su constancia con la fecha de
// la entrega. No se inventa nada, esa fecha ya está cargada.
//
// POR QUÉ IMPORTA EL SEGUIMIENTO, para que la constancia no se lea como un permiso
// permanente: es obligación de la asociación, no del paciente. Sin reportes no hay
// informe semestral que presentar, y el seguimiento terapéutico es parte de lo que
// justifica que esto sea uso medicinal y no otra cosa.

/**
 * Desde cuándo se le pide reporte de seguimiento a cada entrega.
 *
 * ⚠ Cambiar esta fecha cambia a qué entregas ampara la constancia. Es una decisión
 * explícita, no un número para ajustar hasta que la pantalla se ponga verde.
 */
export const SEGUIMIENTO_EXIGIBLE_DESDE = '2026-08-24'

export type EstadoSeguimiento =
  /** La persona reportó cómo le fue. */
  | 'reportado'
  /** La entrega es anterior al requisito: no está en falta, pero se dice. */
  | 'anterior_al_requisito'
  /** Entrega posterior al requisito y sin reporte. Eso sí es una deuda. */
  | 'falta'

export function estadoDelSeguimiento(
  entrega: { id?: string | null; fecha?: string | null },
  reportes: { dispensa_id?: string | null }[],
): EstadoSeguimiento {
  if (entrega.id && reportes.some(r => r.dispensa_id === entrega.id)) return 'reportado'
  // Sin fecha no se puede saber si es anterior, y una entrega sin fecha ya es un
  // problema por su cuenta: no se le regala la constancia.
  const fecha = (entrega.fecha ?? '').slice(0, 10)
  if (!fecha) return 'falta'
  return fecha < SEGUIMIENTO_EXIGIBLE_DESDE ? 'anterior_al_requisito' : 'falta'
}

/** La leyenda que acompaña a una entrega anterior al requisito. */
export function constanciaDeSeguimiento(fecha?: string | null): string {
  const f = (fecha ?? '').slice(0, 10)
  return `Entrega del ${f || 'sin fecha'}, anterior al ${SEGUIMIENTO_EXIGIBLE_DESDE}, que es `
    + 'desde cuando la asociación registra el reporte de seguimiento. No está en falta: el '
    + 'reporte no se puede reconstruir después, porque lo que dice —cuánto alivio dio y qué '
    + 'efectos adversos hubo— sólo lo sabe la persona que lo recibió.'
}
