// El aviso de que el padrón llegó al tope, con a quién conviene desvincular.
//
// El 23/08/2026 el padrón estaba en 198 vinculados contra un tope de 150, y no
// había nada en la app que lo dijera hasta que alguien miraba la barra de
// Capacidad habilitada y la veía en rojo.
//
// LO QUE ESTA PANTALLA NO HACE, A PROPÓSITO
//
// No da de baja a nadie sola. Se pidió que al dar de alta a alguien nuevo el
// sistema desvinculara automáticamente al que menos datos y menos movimiento
// tuviera, y no se hizo así: una baja decidida por un puntaje, sobre la ficha de
// una persona real, es la clase de cosa que no se puede deshacer cuando el
// criterio erra. Acá se propone, con el motivo a la vista, y el gesto lo hace
// una persona de a uno.
//
// Y desvincular NO es borrar. La ficha y su historial quedan enteros: lo único
// que cambia es que deja de contar para el tope. Volver a vincular a alguien es
// marcarlo activo de nuevo en su ficha.

import { useState } from 'react'
import { toast } from 'sonner'
import { UserMinus, AlertTriangle } from 'lucide-react'
import { registroService } from '../../lib/registro'
import type { EstadoPadron } from '../../lib/ong'

/** Cuántos candidatos se muestran antes de pedir «ver más». */
const A_LA_VISTA = 6

/** Desde qué margen se empieza a avisar que queda poco lugar. */
const AVISAR_DESDE = 5

export function PadronEnElTope(
  { padron, onCambio }: { padron: EstadoPadron; onCambio: () => void },
) {
  const [enCurso, setEnCurso] = useState<string | null>(null)
  const [todos, setTodos] = useState(false)

  // Con lugar de sobra no hay nada que decir: avisar acá sería ruido en la
  // pantalla que más se mira.
  if (padron.excedente === 0 && padron.margen > AVISAR_DESDE) return null

  const desvincular = async (id: string, nombre: string) => {
    setEnCurso(id)
    try {
      await registroService.actualizarPaciente(id, { activo: false })
      toast.success(`${nombre} quedó desvinculado. La ficha y su historial siguen enteros.`)
      onCambio()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnCurso(null)
    }
  }

  // Todavía entra, pero queda poco: se avisa sin proponer sacar a nadie.
  if (padron.excedente === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-[#1f1f2b]">
        <p className="text-[11px] text-[#f59e0b]">
          Te {padron.margen === 1 ? 'queda' : 'quedan'}{' '}
          <strong className="font-mono tabular-nums">{padron.margen}</strong>{' '}
          {padron.margen === 1 ? 'alta' : 'altas'} antes de tocar el tope de {padron.tope}.
        </p>
      </div>
    )
  }

  const visibles = todos ? padron.candidatos : padron.candidatos.slice(0, A_LA_VISTA)

  return (
    <div className="mt-3 pt-3 border-t border-[#1f1f2b]">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="text-[#ff8a7a] mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-[12px] text-[#ececf1] font-semibold">
            Sobran {padron.excedente} para entrar en el tope de {padron.tope}
          </p>
          <p className="text-[11px] text-[#8a8a9c] mt-0.5">
            El tope es ampliable por solicitud. Si preferís bajar el padrón, acá están
            los que <strong>nunca retiraron</strong> o hace mucho que no vienen.
            Desvincular no borra nada: la ficha y su historial quedan, y sólo deja de
            contar para el tope.
          </p>
          <p className="text-[10px] text-[#8a8a9c] mt-1">
            No aparecen los que se dieron de alta hace poco, los que tienen REPROCANN
            vigente ni los que retiraron en los últimos meses.
          </p>
        </div>
      </div>

      {padron.candidatos.length === 0 ? (
        <p className="text-[11px] text-[#f59e0b] mt-2">
          No hay a quién sugerir: todos los vinculados retiraron hace poco, tienen
          REPROCANN vigente o se sumaron recién. Para entrar en el tope hay que pedir
          la ampliación.
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-1">
            {visibles.map(c => (
              <li key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-[#12121a] px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="text-[12px] text-[#d4d4dd] truncate">{c.nombre}</p>
                  <p className="text-[10px] text-[#8a8a9c]">{c.motivo}</p>
                </div>
                <button
                  onClick={() => desvincular(c.id, c.nombre)}
                  disabled={enCurso === c.id}
                  // 44px de alto en el teléfono, que es la convención del resto de la
                  // app: es un botón que saca a alguien del padrón y no puede estar
                  // pegado al de al lado, donde el dedo le erra.
                  className="shrink-0 inline-flex items-center justify-center gap-1 rounded-md
                    border border-[#2a2a38] px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-2 sm:py-1
                    text-[11px] text-[#d4d4dd] hover:border-[#ff8a7a] hover:text-[#ff8a7a]
                    disabled:opacity-50 transition-colors">
                  <UserMinus size={12} />
                  {enCurso === c.id ? 'Sacando…' : 'Desvincular'}
                </button>
              </li>
            ))}
          </ul>
          {!todos && padron.candidatos.length > A_LA_VISTA && (
            <button onClick={() => setTodos(true)}
              className="mt-1.5 min-h-[44px] sm:min-h-0 text-[11px] text-[#8a8a9c]
                hover:text-[#d4d4dd] transition-colors">
              ver los {padron.candidatos.length} que se podrían desvincular →
            </button>
          )}
        </>
      )}
    </div>
  )
}
