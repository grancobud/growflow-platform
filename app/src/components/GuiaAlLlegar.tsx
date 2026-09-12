// La guía de una acción, en cualquier pantalla de la app.
//
// Doce formularios muestran su guía adentro del modal, con
// `<GuiaDelFormulario id="...">`. Pero de las treinta y nueve acciones del
// panel, veintisiete llevan a pantallas que no tienen ese modal —el banco de
// genéticas, el ambiente, los costos, el stock— y ahí la guía existía en
// `guiasFormulario.ts` sin que nadie la dibujara nunca. La acción prometía
// acompañar y soltaba en la puerta.
//
// Editar quince pantallas para meterles el mismo recuadro era la otra opción.
// Esto es una sola: la acción se lleva `?guia=costo` en la URL y el recuadro se
// dibuja acá arriba, encima de la pantalla que sea.
//
// El parámetro NO se limpia solo, a diferencia de `nueva` e `ir`. Esos dos
// disparan algo y se van; éste es contenido que se queda leyendo. Se limpia
// cuando la persona lo cierra, así el botón atrás no lo revive.

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { X, Lightbulb } from 'lucide-react'
import { guiaDe } from '../lib/guiasFormulario'
import { limpiarParametro } from '../lib/limpiarParametro'

export function GuiaAlLlegar() {
  const { search, pathname } = useLocation()
  const navegar = useNavigate()
  const [cerrada, setCerrada] = useState(false)

  const id = new URLSearchParams(search).get('guia')
  const g = guiaDe(id ?? '')
  if (!g || cerrada) return null

  const cerrar = () => {
    setCerrada(true)
    limpiarParametro('guia', navegar, pathname)
  }

  return (
    <section aria-label={`Guía: ${g.titulo}`}
      className="mx-3 sm:mx-4 mt-3 rounded-xl bg-[#101016] border border-[#a3e635]/30 overflow-hidden">
      <div className="px-3.5 py-2.5 flex items-start gap-2">
        <Lightbulb aria-hidden className="w-4 h-4 text-[#a3e635] flex-shrink-0 mt-0.5" strokeWidth={1.8} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold text-[13px] text-[#ececf1]">{g.titulo}</h2>
          <p className="text-[11px] text-[#a6a6b5] leading-snug mt-0.5">{g.porQue}</p>

          {g.necesitas.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mt-2.5">
                Vas a necesitar
              </p>
              <ul className="mt-1 space-y-0.5">
                {g.necesitas.map(n => (
                  <li key={n} className="text-[11px] text-[#d4d4dd] leading-snug flex gap-1.5">
                    <span aria-hidden className="text-[#8a8a9c]">·</span>{n}
                  </li>
                ))}
              </ul>
            </>
          )}

          {g.ojo && (
            <p className="text-[11px] leading-snug mt-2 text-[#f59e0b]">
              <span className="font-medium">Ojo: </span>{g.ojo}
            </p>
          )}
        </div>
        <button onClick={cerrar} aria-label="Cerrar la guía"
          className="flex-shrink-0 w-8 h-8 -m-1 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1c1c27] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </section>
  )
}
