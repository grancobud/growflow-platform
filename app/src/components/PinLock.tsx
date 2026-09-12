// PinLock — teclado numerico para desbloquear (o configurar) el PIN de 4 digitos.
//
// modal-exceptuado: es la pantalla de BLOQUEO. Poder cerrarla con el boton
// atras la volveria decorativa — cualquiera entraria apretando atras. Cuando
// se usa para CONFIGURAR el PIN si recibe onCancelar y dibuja su X, porque ahi
// no esta bloqueando nada.

import { useState } from 'react'
import { Leaf, Delete, X } from 'lucide-react'
import { definirPin, verificarPin } from '../lib/pin'

export default function PinLock({ modo, onListo, onCancelar }: {
  modo: 'verificar' | 'configurar'
  onListo: () => void
  onCancelar?: () => void
}) {
  const [pin, setPin] = useState('')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const onDigito = (d: string) => {
    if (pin.length >= 4) return
    setError(false)
    const np = pin + d
    setPin(np)
    if (np.length === 4) setTimeout(() => completar(np), 120)
  }

  const completar = (np: string) => {
    if (modo === 'verificar') {
      if (verificarPin(np)) onListo()
      else { setError(true); setPin(''); navigator.vibrate?.(200) }
      return
    }
    // configurar: pedir dos veces
    if (confirmando === null) { setConfirmando(np); setPin('') }
    else if (confirmando === np) { definirPin(np); onListo() }
    else { setError(true); setConfirmando(null); setPin('') }
  }

  const titulo = modo === 'verificar' ? 'Ingresá tu PIN'
    : confirmando === null ? 'Elegí un PIN de 4 dígitos' : 'Repetí el PIN'

  return (
    <div className="fixed inset-0 z-[60] bg-[#0a0a0f] flex flex-col items-center justify-center p-6 font-sans">
      {onCancelar && (
        <button onClick={onCancelar} className="absolute top-4 right-4 p-2 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cancelar">
          <X className="w-5 h-5" />
        </button>
      )}
      <div className="w-11 h-11 rounded-xl bg-[#a3e635]/15 border border-[#404d20] flex items-center justify-center mb-4">
        <Leaf className="w-5 h-5 text-[#bef264]" strokeWidth={2} />
      </div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#a78bfa] font-semibold mb-1">GrowFlow</p>
      <h1 className={`font-display font-bold text-[18px] mb-6 ${error ? 'text-[#ff8a7a]' : 'text-[#ececf1]'}`}>
        {error ? 'PIN incorrecto, probá de nuevo' : titulo}
      </h1>

      {/* Puntos */}
      <div className="flex gap-4 mb-9">
        {[0, 1, 2, 3].map(i => (
          <span key={i} className={`w-3.5 h-3.5 rounded-full border transition-colors ${
            i < pin.length ? 'bg-[#a3e635] border-[#a3e635]' : 'bg-transparent border-[#3a3a48]'
          }`} />
        ))}
      </div>

      {/* Teclado */}
      <div className="grid grid-cols-3 gap-3.5 w-[252px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} onClick={() => onDigito(d)}
            className="w-[72px] h-[72px] rounded-full bg-[#15151d] border border-[#2a2a3a] hover:bg-[#1c1c27] active:bg-[#232330] text-[24px] font-display font-semibold text-[#ececf1] transition-colors">
            {d}
          </button>
        ))}
        <span />
        <button onClick={() => onDigito('0')}
          className="w-[72px] h-[72px] rounded-full bg-[#15151d] border border-[#2a2a3a] hover:bg-[#1c1c27] active:bg-[#232330] text-[24px] font-display font-semibold text-[#ececf1] transition-colors">
          0
        </button>
        <button onClick={() => { setError(false); setPin(p => p.slice(0, -1)) }}
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-[#8a8a9c] hover:text-[#ececf1] transition-colors"
          aria-label="Borrar">
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}
