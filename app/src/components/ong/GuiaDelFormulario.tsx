// El encabezado explicativo de un formulario, y la ayuda de cada campo.
//
// El texto sale de lib/guiasFormulario.ts: los mismos datos que lee la lista de
// acciones, así que lo que se anuncia antes de entrar es exactamente lo que se
// ve adentro.
//
// La ayuda por campo va DEBAJO del campo y no en un tooltip. Un tooltip hay que
// descubrirlo, y en un celular no existe: no hay dónde apoyar el mouse. Ocupa
// más lugar, sí, y es a propósito — el formulario se llena una vez cada tanto y
// llenarlo mal cuesta más que scrollear.

import { useState, useId } from 'react'
import { Info, AlertTriangle } from 'lucide-react'
import { guiaDe, type GuiaFormulario } from '../../lib/guiasFormulario'

/** El bloque de arriba: para qué es esto y qué hay que tener a mano. */
export function GuiaDelFormulario({ id }: { id: string }) {
  const g = guiaDe(id)
  if (!g) return null

  return (
    <div className="rounded-lg bg-[#15151d] border border-[#2a2a3a] p-3 mb-4">
      <div className="flex items-start gap-2">
        <Info aria-hidden className="w-3.5 h-3.5 text-[#a3e635] flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[12px] text-[#d4d4dd] leading-relaxed">{g.porQue}</p>

          {g.necesitas.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mt-2.5 mb-1">
                Vas a necesitar
              </p>
              <ul className="text-[11px] text-[#a6a6b5] space-y-0.5 list-none m-0 p-0">
                {g.necesitas.map(n => (
                  <li key={n} className="flex items-start gap-1.5">
                    <span aria-hidden className="text-[#8a8a9c] mt-px">·</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * La ayuda de un campo puntual.
 *
 * Se busca por la etiqueta tal como se ve en pantalla, porque quien lee esto
 * está mirando la etiqueta y no el nombre de la columna. Si no hay nada escrito
 * para ese campo no dibuja nada: es preferible un campo sin ayuda que una ayuda
 * que repite la etiqueta con otras palabras.
 */
/**
 * LA AYUDA DE UN CAMPO, PLEGADA HASTA QUE ALGUIEN LA PIDE.
 *
 * Estuvo siempre desplegada, y en un formulario de veinte campos eso son veinte
 * párrafos de 11px que hay que saltear para llegar al siguiente casillero.
 * Socio lo pidió así el 02/09/2026: «una UX como menús y submenús, sin tanta
 * explicación y más intuitivo».
 *
 * PERO NO SE BORRA, Y ESA ES LA PARTE QUE IMPORTA. Estos textos existen porque
 * la 1780 pide cosas que nadie recuerda, y son justo los que van a hacer que
 * Socio pueda cargar sin que Socio esté al lado. Socio no los necesita
 * porque es el Director Técnico; quien entra por primera vez, sí. Plegarlos
 * limpia la pantalla para el que sabe sin dejar sin piso al que aprende.
 *
 * El disparador es un `?` de 16px con área táctil de 44 —el idioma del
 * `after:-inset` que ya usa el panel—, así que en la fila no ocupa más que un
 * carácter y con el dedo se acierta igual.
 */
export function AyudaCampo({ id, campo }: { id: string; campo: string }) {
  const texto = guiaDe(id)?.campos?.[campo]
  const [abierta, setAbierta] = useState(false)
  const idTexto = useId()
  if (!texto) return null
  return (
    <>
      <button type="button" onClick={() => setAbierta(v => !v)}
        aria-expanded={abierta} aria-controls={idTexto}
        aria-label={abierta ? `Ocultar la ayuda de ${campo}` : `Qué va en ${campo}`}
        className="relative mt-1 inline-flex items-center justify-center w-4 h-4 rounded-full border text-[10px] font-semibold leading-none
          after:absolute after:-inset-3 after:content-[''] sm:after:hidden transition-colors
          border-[#2a2a3a] bg-[#15151d] text-[#8a8a9c] hover:text-[#ececf1] hover:border-[#404d20]
          aria-expanded:border-[#404d20] aria-expanded:text-[#d9f99d]">
        ?
      </button>
      {abierta && (
        <p id={idTexto} className="text-[11px] text-[#8a8a9c] mt-1 leading-relaxed">{texto}</p>
      )}
    </>
  )
}

/** Lo que suele salir mal. Va al pie del formulario, cerca del botón de guardar. */
export function OjoDelFormulario({ id }: { id: string }) {
  const ojo = guiaDe(id)?.ojo
  if (!ojo) return null
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[#f59e0b]/8 border border-[#f59e0b]/25 p-2.5 mt-1">
      <AlertTriangle aria-hidden className="w-3.5 h-3.5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-[#d4d4dd] leading-relaxed">{ojo}</p>
    </div>
  )
}

export type { GuiaFormulario }
