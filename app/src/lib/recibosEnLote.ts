// Emitir de una vez los recibos que nunca se emitieron.
//
// POR QUÉ EXISTE ESTO
//
// Al 23/08/2026 la base de la asociación tenía 1.241 entregas cargadas y CERO recibos
// emitidos. Se numeraron 846 —las de modalidad Paciente con aporte mayor a
// cero, que son las que documentan un reembolso— del 1 al 846 en orden de
// fecha. Falta el papel de cada una, y hacerlos de a uno abriendo el visor son
// 846 veces la misma secuencia de clics.
//
// LO QUE NO PUEDE FALLAR
//
// Emitir dos veces el mismo recibo deja dos papeles oficiales con el mismo
// número, y en un libro numerado eso es peor que no tener ninguno. Por eso
// `recibosPendientes` mira qué entregas YA tienen su documento y las saltea:
// el lote se puede cortar a la mitad y volver a correr sin duplicar nada.
//
// LA FECHA ES LA DE LA ENTREGA, NO LA DE HOY
//
// El visor de a uno estampa la fecha de emisión, que para un recibo que se
// emite en el momento es lo correcto. Acá no: son recibos retroactivos de
// aportes que entraron el día de la entrega. Ponerles la fecha de hoy diría que
// esa plata entró hoy, y no entró hoy.
//
// ⚠ SALEN INCOMPLETOS Y ES A PROPÓSITO. Con `ong_entidad` sin CUIT ni razón
// social, los 846 salen con [CUIT], [RAZÓN SOCIAL] y [DOMICILIO DE LA SEDE]
// impresos, y los de paciente sin REPROCANN además con [N° REPROCANN]. Se
// decidió emitirlos igual el 23/08/2026, sabiendo eso. Un documento emitido
// queda CONGELADO —el texto se guarda en `notas` para poder reabrirlo tal cual
// salió—, así que corregirlos después es borrar los 846 y volver a emitirlos.

import { reciboReembolso } from './documentosLegales'
import { pdfDelDocumento, registroDeEntidad } from './pdfDocumento'
import { ongService, type Dispensa, type Entidad, type DocumentoONG } from './ong'
import type { Paciente } from './registro'
import type { Asociado } from './ong'

/** El subtipo con el que la pantalla de Dispensas archiva un recibo. */
export const SUBTIPO_RECIBO = 'Recibo de reembolso'

/**
 * Las entregas ya numeradas a las que todavía les falta el papel, en orden de
 * número, que es el orden del libro.
 *
 * Se saltea la que ya tiene su documento: correr el lote dos veces no duplica
 * nada, así que se puede cortar y retomar.
 */
export function recibosPendientes<T extends { id: string; recibo_numero?: number | null }>(
  dispensas: T[],
  documentos: { dispensa_id?: string | null; subtipo?: string | null }[],
): T[] {
  const yaEmitidas = new Set(
    documentos
      .filter(x => x.subtipo === SUBTIPO_RECIBO && x.dispensa_id)
      .map(x => x.dispensa_id as string),
  )
  return dispensas
    .filter(d => d.recibo_numero != null && !yaEmitidas.has(d.id))
    .sort((a, b) => (a.recibo_numero ?? 0) - (b.recibo_numero ?? 0))
}

/** La fecha que va en el papel: la de la entrega. Nunca la de hoy. */
export function fechaDelRecibo(d: { fecha?: string | null }): string | null {
  return d.fecha ?? null
}

export interface AvanceDelLote {
  hechos: number
  total: number
  fallados: { numero: number | null; motivo: string }[]
}

/**
 * Emite y archiva los recibos pendientes, de a uno y en orden.
 *
 * De a uno y no en paralelo a propósito: son 846 PDF y 846 subidas al bucket, y
 * mandarlas todas juntas es la forma de que el navegador se quede sin memoria o
 * el storage empiece a rechazar por ráfaga. Tarda más y termina.
 *
 * Si uno falla, sigue con el resto y lo anota. Cortar todo el lote porque un
 * recibo no encontró su paciente dejaría los 845 restantes sin emitir.
 */
export async function emitirRecibosEnLote(
  pendientes: Dispensa[],
  ctx: {
    entidad: Entidad | null
    pacientePorId: (id: string | null | undefined) => Paciente | null
    asociadoPorPaciente: (id: string | null | undefined) => Asociado | null
  },
  onAvance?: (a: AvanceDelLote) => void,
): Promise<AvanceDelLote> {
  const avance: AvanceDelLote = { hechos: 0, total: pendientes.length, fallados: [] }

  for (const d of pendientes) {
    try {
      const pac = ctx.pacientePorId(d.paciente_id)
      const aso = ctx.asociadoPorPaciente(d.paciente_id)
      const doc = reciboReembolso(d, ctx.entidad, pac, aso)
      const fecha = fechaDelRecibo(d)

      // El PDF puede fallar sin que se pierda la constancia: igual que en el
      // visor de a uno, el documento se archiva aunque el adjunto no salga.
      let archivado: { path: string; nombre: string } | null = null
      try {
        const blob = await pdfDelDocumento({
          titulo: doc.titulo,
          texto: doc.texto,
          entidadNombre: ctx.entidad?.razon_social ?? null,
          registro: registroDeEntidad(ctx.entidad),
          emitido: fecha
            ? new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR')
            : '',
        })
        const nombre = `recibo-${String(d.recibo_numero).padStart(4, '0')}.pdf`
        archivado = await ongService.subirArchivoDocumento(
          new File([blob], nombre, { type: 'application/pdf' }))
      } catch { /* se archiva igual, sin adjunto */ }

      await ongService.guardarDocumento({
        archivo_path: archivado?.path ?? null,
        archivo_nombre: archivado?.nombre ?? null,
        tipo: 'emitido',
        subtipo: SUBTIPO_RECIBO,
        numero: d.recibo_numero != null ? String(d.recibo_numero) : null,
        paciente_id: d.paciente_id ?? null,
        dispensa_id: d.id,
        monto: Number(d.aporte) || null,
        fecha,
        descripcion: doc.titulo,
        notas: doc.texto,
      } as DocumentoONG)

      avance.hechos++
    } catch (e) {
      avance.fallados.push({ numero: d.recibo_numero ?? null, motivo: (e as Error).message })
    }
    onAvance?.({ ...avance, fallados: [...avance.fallados] })
  }

  return avance
}
