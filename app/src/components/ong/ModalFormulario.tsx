// El modal de un formulario que se guarda: título, aviso opcional, y los dos
// botones al pie.
//
// Vivía adentro de Seguimiento. Al separar el seguimiento clínico del libro de
// caja quedaron dos formularios usándolo desde archivos distintos, así que pasa
// a vivir solo en vez de copiarse.
//
// OJO, DEUDA CONOCIDA: hay seis `Modal` locales más repartidos por la app
// (Dispensas, LibrosYActas, Declaraciones, AsociadosYCoherencia, PaginaONG,
// AsociadosYCoherencia), parecidos pero no iguales. Unificarlos es un cambio
// aparte; esto no agrega uno más, que era lo importante hoy.

import { Lock, X } from 'lucide-react'
import { btnPrimario, btnSutil } from '../../lib/ui'
import { useDialogo } from '../../lib/useDialogo'

export function ModalFormulario({ titulo, aviso, onCerrar, onGuardar, children }: {
  titulo: string; aviso?: string; onCerrar: () => void; onGuardar: () => void; children: React.ReactNode
}) {
  const refDialogo = useDialogo(onCerrar)
  return (
    <div ref={refDialogo} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] sticky top-0 bg-[#0d0d12] flex items-center gap-2">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">{titulo}</h3>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="ml-auto min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {aviso && (
            <p className="flex items-start gap-1.5 text-[11px] text-[#fbbf24] rounded-lg bg-[#5a4a20]/15 border border-[#5a4a20] p-2.5 leading-relaxed">
              <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-px" strokeWidth={1.8} />{aviso}
            </p>
          )}
          {children}
        </div>
        <div className="px-4 py-3 border-t border-[#1f1f2b] flex gap-2 sticky bottom-0 bg-[#0d0d12]">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={onGuardar} className={`${btnPrimario} flex-1`}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
