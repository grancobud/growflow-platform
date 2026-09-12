// «¿Qué querés hacer?» arriba del cultivo.
//
// POR QUÉ CERRADA POR DEFECTO
//
// Las nueve acciones en fila miden unos 640px en un teléfono. Cultivo no es una
// pantalla de entrada: es Plantas, y a Plantas se entra a mirar las plantas. Una
// botonera abierta empujaría la primera planta abajo del pliegue TODAS las
// veces, para ofrecer algo que se usa una vez por semana. Cerrada cuesta 44px y
// sigue estando a un toque.
//
// Es el mismo trato que ya hace la O.N.G. con «ver todo»: lo de todos los días
// arriba, el resto detrás de un botón. Acá no hay «lo de todos los días» porque
// ninguna de las nueve lo es —cargar plantas o crear un área se hacen al empezar
// un ciclo, no cada mañana—, así que van las nueve juntas.
//
// Sin animación de altura, a propósito: se muestra o no se muestra. Animar el
// alto de un bloque que crece 640px es lo que hace saltar la pantalla en el
// teléfono, y el movimiento que aporta no vale lo que cuesta.

import { useState } from 'react'
import { ChevronDown, Wrench } from 'lucide-react'
import { FilaAccion } from './ong/FilaAccion'
import { ACCIONES_CULTIVO, saleDeCultivo } from '../lib/accionesOng'

export function BotoneraCultivo() {
  const [abierta, setAbierta] = useState(false)

  return (
    <section className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">
      <button onClick={() => setAbierta(v => !v)}
        aria-expanded={abierta}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] text-left hover:bg-[#15151d] transition-colors">
        <Wrench aria-hidden className="w-3.5 h-3.5 text-[#a3e635] flex-shrink-0" strokeWidth={2} />
        <span className="font-display font-semibold text-[13px] text-[#ececf1]">
          ¿Qué querés hacer?
        </span>
        <span className="text-[11px] text-[#8a8a9c]">{ACCIONES_CULTIVO.length}</span>
        <ChevronDown aria-hidden
          className={`w-3.5 h-3.5 text-[#8a8a9c] ml-auto flex-shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>

      {abierta && (
        <div className="px-3 pb-3 border-t border-[#1f1f2b] pt-3 grid gap-1.5 sm:grid-cols-2 auto-rows-fr">
          {ACCIONES_CULTIVO.map(a => (
            <FilaAccion key={a.id} a={a} detalle sale={saleDeCultivo(a)} />
          ))}
        </div>
      )}
    </section>
  )
}
