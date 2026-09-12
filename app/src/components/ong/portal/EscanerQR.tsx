// Lector de QR para el retiro en sede (CU-06, paso 1).
//
// Devuelve el texto leído y se cierra. No decide nada: quien lo abre resuelve
// qué hacer con el código, que en el mostrador es buscar la reserva y mirar su
// chequeo antes de entregar nada.

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'
import { X, Camera } from 'lucide-react'
import { btnSutil } from '../../../lib/ui'
import { useDialogo } from '../../../lib/useDialogo'

export function EscanerQR({ onLeido, onCerrar }: {
  onLeido: (texto: string) => void
  onCerrar: () => void
}) {
  const refDialogo = useDialogo(onCerrar)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE])
    const reader = new BrowserMultiFormatReader(hints)
    let controls: { stop: () => void } | null = null
    let vivo = true

    reader.decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
      // Sin el guard, un QR bien iluminado dispara el callback muchas veces por
      // segundo y se abriría la misma reserva una y otra vez.
      if (!vivo || !result) return
      vivo = false
      controls?.stop()
      onLeido(result.getText())
    }).then(c => {
      controls = c
      if (!vivo) c.stop()
    }).catch((e: Error) => {
      setError(e.message.includes('Permission') || e.name === 'NotAllowedError'
        ? 'No se pudo abrir la cámara: falta el permiso del navegador.'
        : `No se pudo abrir la cámara: ${e.message}`)
    })

    return () => { vivo = false; controls?.stop() }
  }, [onLeido])

  return (
    <div ref={refDialogo} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4" onClick={onCerrar}>
      <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] text-[#ececf1] flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-[#a3e635]" /> Escaneá el QR de la reserva
          </p>
          <button onClick={onCerrar} className={btnSutil} aria-label="Cerrar escáner">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="px-4 pb-4">
          <button onClick={onCerrar} className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">Cancelar</button>
        </div>

        {error ? (
          <div className="rounded-xl bg-[#101016] border border-[#ff8a7a]/30 p-4">
            <p className="text-[12px] text-[#ff8a7a]">{error}</p>
            <p className="text-[11px] text-[#8a8a9c] mt-2">
              Podés escribir el código a mano en el buscador: es el que figura arriba del QR.
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-[#2a2a3a] bg-black">
            <video ref={videoRef} className="w-full aspect-square object-cover" muted playsInline />
          </div>
        )}
      </div>
    </div>
  )
}
