// Emitir de una vez los recibos que nunca se emitieron.
//
// Al 23/08/2026 había 1.241 entregas cargadas y CERO recibos. Se numeraron 846
// y hacer el papel de cada una desde el visor son 846 veces la misma secuencia
// de clics.
//
// El botón dice a cuántos les falta y QUÉ va a salir mal antes de apretarlo, no
// después: si la entidad no tiene CUIT, los recibos salen con [CUIT] impreso, y
// un documento emitido queda congelado —el texto se guarda para reabrirlo tal
// cual salió—, así que corregirlos es borrarlos y rehacerlos. Eso hay que
// saberlo ANTES, con el número a la vista.

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Receipt, AlertTriangle } from 'lucide-react'
import { recibosPendientes, emitirRecibosEnLote, type AvanceDelLote } from '../../lib/recibosEnLote'
import type { Dispensa, Entidad, DocumentoONG, Asociado } from '../../lib/ong'
import type { Paciente } from '../../lib/registro'
import { confirmarAccion } from '../../lib/confirmar'

export function EmitirRecibosPendientes({
  dispensas, documentos, pacientes, asociados, entidad, onCambio,
}: {
  dispensas: Dispensa[]
  documentos: DocumentoONG[]
  pacientes: Paciente[]
  asociados: Asociado[]
  entidad: Entidad | null
  onCambio: () => void
}) {
  const [avance, setAvance] = useState<AvanceDelLote | null>(null)
  const [corriendo, setCorriendo] = useState(false)

  const pendientes = useMemo(
    () => recibosPendientes(dispensas, documentos), [dispensas, documentos])

  // Lo que va a salir incompleto, contado ANTES de emitir.
  const sinCuit = !entidad?.cuit?.trim()
  const sinReprocann = useMemo(() => {
    const porId = new Map(pacientes.map(p => [p.id, p]))
    return pendientes.filter(d => !porId.get(d.paciente_id ?? '')?.reprocann_nro?.trim()).length
  }, [pendientes, pacientes])

  if (pendientes.length === 0) return null

  const emitir = async () => {
    const aviso = [
      `Se van a emitir y archivar ${pendientes.length} recibos.`,
      sinCuit && 'La entidad NO tiene CUIT cargado: todos van a salir con [CUIT], [RAZÓN SOCIAL] y [DOMICILIO] impresos.',
      sinReprocann > 0 && `${sinReprocann} van a salir con [N° REPROCANN] impreso.`,
      'Un documento emitido queda congelado. Para corregirlos hay que borrarlos y volver a emitirlos.',
      '¿Seguimos?',
    ].filter(Boolean).join('\n\n')
    // `confirmarAccion` y no `confirmarBorrado`: esto EMITE documentos, no borra
    // nada. El boton rojo con la palabra «Borrar» diria lo contrario de lo que hace.
    if (!await confirmarAccion({
      titulo: `¿Emitir ${pendientes.length} recibos?`,
      descripcion: aviso,
      confirmLabel: 'Emitir',
      variant: sinCuit || sinReprocann > 0 ? 'warning' : 'default',
    })) return

    setCorriendo(true)
    setAvance({ hechos: 0, total: pendientes.length, fallados: [] })
    try {
      const porId = new Map(pacientes.map(p => [p.id, p]))
      const asoPorPac = new Map(asociados.filter(a => a.paciente_id).map(a => [a.paciente_id as string, a]))
      const fin = await emitirRecibosEnLote(pendientes, {
        entidad,
        pacientePorId: id => porId.get(id ?? '') ?? null,
        asociadoPorPaciente: id => asoPorPac.get(id ?? '') ?? null,
      }, setAvance)

      if (fin.fallados.length === 0) toast.success(`${fin.hechos} recibos emitidos y archivados`)
      else toast.warning(`${fin.hechos} emitidos · ${fin.fallados.length} quedaron sin emitir`)
      onCambio()
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setCorriendo(false) }
  }

  const pct = avance && avance.total > 0
    ? Math.round((avance.hechos + avance.fallados.length) / avance.total * 100) : 0

  return (
    <div className="rounded-xl bg-[#101016] border border-[#f59e0b]/30 p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <Receipt size={15} className="text-[#f59e0b] mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-display font-semibold text-[13px] text-[#ececf1]">
            {pendientes.length} recibos numerados sin papel emitido
          </p>
          <p className="text-[11px] text-[#a6a6b5] mt-0.5 leading-relaxed">
            Ya tienen su número correlativo en el libro. Lo que falta es el PDF archivado
            de cada uno. Se emiten con <strong>la fecha de la entrega</strong>, no con la de hoy.
          </p>

          {(sinCuit || sinReprocann > 0) && (
            <div className="mt-2 rounded-lg bg-[#f59e0b]/10 px-2.5 py-2">
              <p className="flex items-start gap-1.5 text-[11px] text-[#f59e0b]">
                <AlertTriangle size={12} className="mt-[2px] shrink-0" />
                <span>
                  Van a salir incompletos.
                  {sinCuit && ' La entidad no tiene CUIT ni razón social, así que TODOS llevan [CUIT] impreso.'}
                  {sinReprocann > 0 && ` ${sinReprocann} además sin REPROCANN.`}
                  {' '}Un documento emitido queda congelado: corregirlos es borrarlos y rehacerlos.
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {avance && corriendo && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-[#1f1f2b] overflow-hidden">
            <div className="h-full w-full rounded-full bg-[#f59e0b] origin-left transition-transform" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <p className="text-[11px] text-[#8a8a9c] mt-1 tabular-nums">
            {avance.hechos} de {avance.total}
            {avance.fallados.length > 0 && ` · ${avance.fallados.length} fallaron`}
          </p>
        </div>
      )}

      {avance && !corriendo && avance.fallados.length > 0 && (
        <p className="mt-2 text-[11px] text-[#ff8a7a]">
          {avance.fallados.length} quedaron sin emitir. Se pueden reintentar: los que ya
          salieron no se vuelven a emitir.
        </p>
      )}

      <button onClick={emitir} disabled={corriendo}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border
          border-[#f59e0b]/40 bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 px-3 py-2 min-h-[44px]
          sm:min-h-0 text-[12px] font-medium text-[#f59e0b] disabled:opacity-50 transition-colors">
        <Receipt size={13} />
        {corriendo ? 'Emitiendo…' : `Emitir los ${pendientes.length}`}
      </button>
    </div>
  )
}
