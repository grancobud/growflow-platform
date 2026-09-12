// «¿Qué querés hacer?», arriba de la pantalla de entrada de la O.N.G.
//
// La lógica de si cada acción se puede hacer vive en lib/accionesOng.ts, aparte,
// para poder testearla sin navegador. Acá sólo se dibuja.
//
// En grilla y no en lista: seis renglones de texto se leen uno por uno, seis
// tarjetas con icono se barren de un vistazo. El icono hace de ancla — al tercer
// día uno reconoce la forma antes de leer la palabra.
//
// Las bloqueadas se muestran apagadas, no se esconden. Una acción que falta sin
// explicación deja pensando si existe o si uno no la encuentra; apagada con el
// motivo se convierte en una instrucción.
//
// Las frecuentes arriba y el resto detrás de «ver todo». Meter las dieciocho en
// la entrada sería el mismo error que las dieciocho pestañas en una fila.

import { useState } from 'react'
import { FilaAccion } from './FilaAccion'
import { ChevronDown } from 'lucide-react'
import {
  accionesOng, ORDEN_RITMO, TITULO_RITMO,
  type Accion, type GrupoAccion,
} from '../../lib/accionesOng'
import type { Entidad, LoteIngreso, Cuota, Asociado } from '../../lib/ong'
import { useAuth } from '../../hooks/useAuth'

const GRUPOS: { id: GrupoAccion; label: string }[] = [
  { id: 'operacion', label: 'Operación' },
  { id: 'personas', label: 'Personas' },
  { id: 'institucional', label: 'Institucional' },
  { id: 'papeles', label: 'Papeles' },
  { id: 'cultivo', label: 'Cultivo y ambiente' },
  { id: 'costos', label: 'Costos' },
  { id: 'panel', label: 'Panel' },
]

/**
 * Los grupos que viven enteros fuera de la O.N.G.
 *
 * No se esconden: el material que se entrega sale del cultivo, y quien busca
 * «cargar plantas» desde acá lo tiene que encontrar. Pero van abajo y con su
 * propio título, para que la sección de la O.N.G. sea de la O.N.G.
 */
const GRUPOS_FUERA: GrupoAccion[] = ['cultivo', 'costos']

export function QueQuieroHacer(datos: {
  entidad: Entidad | null
  pacientes: number
  lotes: LoteIngreso[]
  asociados: Asociado[]
  cuotas: Cuota[]
}) {
  const { tienePermiso } = useAuth()
  const [verTodo, setVerTodo] = useState(false)
  // SÓLO LO QUE ESTE ROL PUEDE HACER. Igual que en el Panel: una acción que la
  // base va a rechazar no es una acción, es una promesa rota. Ver el comentario
  // del campo `permiso` en lib/accionesOng.ts.
  const todas = accionesOng(datos).filter(a => tienePermiso(a.permiso))
  // Por uso real y no por orden de definición. El orden lo declara cada acción
  // en `ordenPortada`, que sale de contar la base de producción: ver el
  // comentario de ese campo en lib/accionesOng.ts.
  const frecuentes = todas.filter(a => a.frecuente)
    .sort((a, b) => (a.ordenPortada ?? 99) - (b.ordenPortada ?? 99))
  const resto = todas.filter(a => !a.frecuente)

  return (
    <section className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">
      <div className="px-3.5 py-3 border-b border-[#1f1f2b]">
        <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">¿Qué querés hacer?</h2>
        <p className="text-[11px] text-[#8a8a9c] mt-0.5 [text-wrap:pretty]">
          Cada una te abre la pantalla donde se hace. Si algo no se puede
          todavía, dice qué falta.
        </p>
      </div>

      {/* LA PORTADA VA EN FILAS Y AGRUPADA POR RITMO.
          Eran seis tarjetas iguales de 96px: en un telefono entraban dos y
          media, y las seis pesaban lo mismo — no se veia que dos son la rutina
          diaria y una es de fin de mes. En fila son 56px y entran las seis.
          Lo que se pierde es el detalle largo, que ayuda la primera semana y
          despues es texto que hay que saltear todos los dias; sigue estando en
          el resto de las acciones, que son las que no se conocen de memoria. */}
      <div className="p-3 flex flex-col gap-1.5 sm:gap-3">
        {ORDEN_RITMO.map(ritmo => {
          const delGrupo = frecuentes.filter(a => a.ritmo === ritmo)
          if (delGrupo.length === 0) return null
          return (
            <div key={ritmo}>
              {/* EL TÍTULO DEL GRUPO, SÓLO DONDE SOBRA LUGAR.
                  Medido a 375px: las filas bajan el bloque de 421px a 375, pero
                  los tres títulos lo devuelven a 465 — o sea que agrupar cuesta
                  90px justo donde no hay. Con seis acciones la agrupación aporta
                  poco: el orden ya es por frecuencia y se lee igual.
                  En pantalla ancha no cuesta nada y sí ayuda, así que ahí queda.
                  Cuando la portada crezca, vuelve a valer en las dos. */}
              <div className="hidden sm:flex items-center gap-2 mb-1.5">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium whitespace-nowrap">
                  {TITULO_RITMO[ritmo]}
                </span>
                <span aria-hidden className="flex-1 h-px bg-[#1f1f2b]" />
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 auto-rows-fr">
                {delGrupo.map(a => <FilaAccion key={a.id} a={a} />)}
              </div>
            </div>
          )
        })}
        {/* Una accion frecuente sin ritmo no se pierde: cae acá. El test lo
            impide de entrada, pero esconderla seria peor que mostrarla suelta. */}
        {frecuentes.some(a => !a.ritmo) && (
          <div className="grid gap-1.5 sm:grid-cols-2 auto-rows-fr">
            {frecuentes.filter(a => !a.ritmo).map(a => <FilaAccion key={a.id} a={a} />)}
          </div>
        )}
      </div>

      {resto.length > 0 && (
        <>
          <button onClick={() => setVerTodo(v => !v)}
            aria-expanded={verTodo}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] border-t border-[#1f1f2b] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#15151d] transition-colors">
            {verTodo ? 'Ver sólo lo de todos los días' : `Ver todo lo que se puede hacer (${resto.length} más)`}
            <ChevronDown aria-hidden className={`w-3.5 h-3.5 transition-transform ${verTodo ? 'rotate-180' : ''}`} />
          </button>

          {verTodo && (
            <>
              {GRUPOS.filter(g => !GRUPOS_FUERA.includes(g.id)).map(g => (
                <Grupo key={g.id} label={g.label} del={resto.filter(a => a.grupo === g.id)} />
              ))}

              {/* Lo que deja la O.N.G., junto y avisado. Antes venía intercalado
                  entre los grupos institucionales, y el panel de la O.N.G.
                  terminaba ofreciendo regar una sala. */}
              {resto.some(a => GRUPOS_FUERA.includes(a.grupo)) && (
                <div className="border-t-2 border-[#1f1f2b] px-3.5 pt-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
                    Fuera de la O.N.G.
                  </p>
                  <p className="text-[10px] text-[#8a8a9c] mt-0.5 leading-snug">
                    Son parte del circuito —el material que entregás sale de acá— pero se hacen
                    en otra sección de la app.
                  </p>
                </div>
              )}
              {GRUPOS.filter(g => GRUPOS_FUERA.includes(g.id)).map(g => (
                <Grupo key={g.id} label={g.label} del={resto.filter(a => a.grupo === g.id)} />
              ))}
            </>
          )}
        </>
      )}
    </section>
  )
}

function Grupo({ label, del }: { label: string; del: Accion[] }) {
  if (!del.length) return null
  return (
    <div className="border-t border-[#1f1f2b]">
      <p className="px-3.5 pt-3 text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
        {label}
      </p>
      <div className="p-3 grid gap-1.5 sm:grid-cols-2 auto-rows-fr">
        {del.map(a => <FilaAccion key={a.id} a={a} detalle />)}
      </div>
    </div>
  )
}
