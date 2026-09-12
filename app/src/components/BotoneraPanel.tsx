// La botonera del Panel: qué se puede hacer ahora y qué está trabado.
//
// El Panel es la ruta raíz —lo primero que ve todo el mundo al entrar— y hasta
// ahora mostraba números. Los números están bien para saber cómo va la cosa,
// pero nadie entra a la app a mirar: entra a hacer algo.
//
// POR QUÉ NO ES UN MENÚ DE SECCIONES
//
// La tentación es poner acá un índice: O.N.G., Cultivo, Cosecha, Economía. Eso
// agrega un clic a todo y no dice nada que el menú lateral no diga ya. Un índice
// te hace buscar; esto te dice.
//
// La diferencia la hace un dato que las acciones ya tienen y que nadie estaba
// aprovechando fuera de la O.N.G.: cada una sabe si está `lista`, con `aviso` o
// `bloqueada`, y por qué. Con eso el Panel puede ordenar por situación en vez de
// por categoría.
//
//   arriba    lo que se puede hacer hoy, por uso real (ordenPortada)
//   abajo     lo que está trabado, con el motivo y el link que lo destraba
//
// Y las de cada sección se quedan en su sección: las de cultivo en Cultivo, las
// de la O.N.G. en O.N.G. Acá va sólo lo transversal y lo urgente.

import { Link } from 'react-router-dom'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { createElement } from 'react'
import { iconoDeAccion } from '../lib/iconosAccion'
import { Lock, AlertTriangle, ChevronDown } from 'lucide-react'
import {
  GRUPOS_ACCION_ORDEN, ORDEN_RITMO, TITULO_RITMO, type Accion,
} from '../lib/accionesOng'
import { FilaAccion } from './ong/FilaAccion'
import { EASE } from '../lib/motion'
import { Desplegable } from './ui/Desplegable'


/** Cuántas acciones disponibles se muestran. Más que esto deja de ser botonera. */
const MAXIMO_LISTAS = 6
/** Y cuántas trabadas. Si hay más, la instalación tiene un problema más grande. */
const MAXIMO_TRABADAS = 4

const Icono = ({ nombre, className }: { nombre: string; className?: string }) =>
  createElement(iconoDeAccion(nombre), { className, strokeWidth: 1.8 })

export function BotoneraPanel({ acciones }: { acciones: Accion[] }) {
  const [verTodo, setVerTodo] = useState(false)
  // Por uso real y no por orden de definición: `ordenPortada` sale de contar la
  // base de producción, no de agrupar por tema. Ver el comentario de ese campo.
  const listas = acciones
    .filter(a => a.estado !== 'bloqueada')
    .sort((a, b) => (a.ordenPortada ?? 99) - (b.ordenPortada ?? 99))
    .slice(0, MAXIMO_LISTAS)

  const trabadas = acciones
    .filter(a => a.estado === 'bloqueada')
    .slice(0, MAXIMO_TRABADAS)

  /**
   * TODO LO DEMAS QUE LA APP SABE HACER.
   *
   * El Panel mostraba SEIS acciones de treinta y nueve. Las nueve de cultivo
   * —cargar plantas, regar una sala, pasar a floracion, cargar una lectura de
   * ambiente— y las cuatro de costos ya estaban escritas, con su ruta y su
   * logica de bloqueo, y no llegaban a ninguna pantalla: `ordenPortada` solo lo
   * tienen las de la O.N.G., asi que el corte de seis las dejaba siempre afuera.
   *
   * No se suben las treinta y nueve a la vista: eso seria la lista larga que la
   * botonera existe para evitar. Van detras de un desplegable y agrupadas por
   * area, que es el mismo patron que ya usa la O.N.G.
   */
  const enPortada = new Set(listas.concat(trabadas).map(a => a.id))
  const resto = acciones.filter(a => !enPortada.has(a.id))

  if (!listas.length && !trabadas.length) return null

  // La entrada dura 200ms y no 400: esta botonera es lo PRIMERO que se ve al
  // abrir el Panel, o sea varias veces por dia, y a esa frecuencia el
  // movimiento tiene que ser corto o se convierte en una espera. La regla de
  // sub-300ms existe justamente para lo que se ve seguido.
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">

      <div className="px-4 sm:px-5 py-3 border-b border-[#1f1f2b]">
        <h2 className="font-display font-semibold text-[13px] text-[#ececf1]">¿Qué querés hacer?</h2>
        <p className="text-[11px] text-[#8a8a9c] mt-0.5">
          Lo de todos los días. Cada sección tiene el resto de lo suyo.
        </p>
      </div>

      {/* LA MISMA FILA Y EL MISMO AGRUPADO QUE EL PANEL DE LA O.N.G.
          Eran dos diseños para la misma botonera: medido, la misma acción daba
          76 px acá y 56 allá, con detalle e ícono en cajita de un lado y sin
          nada de eso del otro. Se nota apenas se pasa de una pantalla a la
          otra. Ahora las dos dibujan `FilaAccion`, así que cambiar una cambia
          las dos. */}
      {listas.length > 0 && (
        <div className="p-3 sm:p-4 flex flex-col gap-1.5 sm:gap-3">
          {ORDEN_RITMO.map(ritmo => {
            const delGrupo = listas.filter(a => a.ritmo === ritmo)
            if (delGrupo.length === 0) return null
            return (
              <div key={ritmo}>
                {/* El título del grupo sólo donde sobra lugar: en el teléfono
                    los tres devolvían el bloque de 375 px a 465. */}
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
          {/* Una frecuente sin ritmo no se pierde: cae acá. El test lo impide de
              entrada, pero esconderla sería peor que mostrarla suelta. */}
          {listas.some(a => !a.ritmo) && (
            <div className="grid gap-1.5 sm:grid-cols-2 auto-rows-fr">
              {listas.filter(a => !a.ritmo).map(a => <FilaAccion key={a.id} a={a} />)}
            </div>
          )}
        </div>
      )}

      {/* LAS TRABADAS SON UN GRUPO MAS, no una caja aparte.
          Tenian su propio recuadro con borde y fondo propio, mientras los otros
          tres grupos son solo titulo y filas: en una pantalla con cuatro
          bloques, el unico distinto se lee como que algo esta mal ahi. Lo que
          las distingue ya es suficiente —el candado, el gris, y el «Falta:»— y
          eso lo pone `FilaAccion` sola. */}
      {trabadas.length > 0 && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Lock aria-hidden className="w-3 h-3 text-[#8a8a9c] flex-shrink-0" strokeWidth={2} />
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium whitespace-nowrap">
              Todavía no se puede
            </span>
            <span aria-hidden className="flex-1 h-px bg-[#1f1f2b]" />
          </div>
          {/* Cada fila lleva a DONDE SE RESUELVE, no a la acción trabada:
              mandar a la pantalla que no funciona sería repetir el problema.
              Eso ya lo decide `FilaAccion`. */}
          <div className="grid gap-1.5 sm:grid-cols-2 auto-rows-fr">
            {trabadas.map(a => <FilaAccion key={a.id} a={a} />)}
          </div>
        </div>
      )}

      {/* El resto de lo que la app sabe hacer, por area. Colapsado: la botonera
          es para lo de todos los dias, y una lista de treinta y nueve renglones
          al abrir el Panel es lo mismo que no tener botonera. */}
      {resto.length > 0 && (
        <>
          <button onClick={() => setVerTodo(v => !v)}
            aria-expanded={verTodo}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] border-t border-[#1f1f2b] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#15151d] transition-colors">
            {verTodo ? 'Ver sólo lo de todos los días' : `Ver todo lo que se puede hacer (${resto.length} más)`}
            <ChevronDown aria-hidden className={`w-3.5 h-3.5 transition-transform ${verTodo ? 'rotate-180' : ''}`} />
          </button>

          <Desplegable abierto={verTodo} className="p-3 sm:p-4 pt-0 flex flex-col gap-3">
              {GRUPOS_ACCION_ORDEN.map(g => {
                const delGrupo = resto.filter(a => a.grupo === g.id)
                if (delGrupo.length === 0) return null
                return (
                  <div key={g.id}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium whitespace-nowrap">
                        {g.label}
                      </span>
                      <span aria-hidden className="flex-1 h-px bg-[#1f1f2b]" />
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2 auto-rows-fr">
                      {delGrupo.map(a => <FilaChica key={a.id} a={a} />)}
                    </div>
                  </div>
                )
              })}
          </Desplegable>
        </>
      )}
    </motion.section>
  )
}

/**
 * Una acción del resto, en fila.
 *
 * Sin el detalle: son treinta y tres y el nombre alcanza —«Cargar plantas»,
 * «Regar o fumigar una sala»—. El detalle está en la pantalla de la O.N.G.,
 * donde la lista es la principal y no el segundo plano de otra.
 *
 * Bloqueada lleva a DONDE SE RESUELVE, no a la acción trabada: mandar a la
 * pantalla que no funciona sería repetir el problema.
 */
function FilaChica({ a }: { a: Accion }) {
  const bloqueada = a.estado === 'bloqueada'
  return (
    <Link to={bloqueada ? (a.rutaMotivo ?? a.ruta) : a.ruta}
      aria-label={a.motivo ? `${a.label}. ${bloqueada ? 'No se puede todavía' : 'Ojo'}: ${a.motivo}.` : a.label}
      className={`flex items-center gap-2 px-2.5 py-2 min-h-[44px] rounded-lg border transition-colors ${
        bloqueada
          ? 'border-[#1f1f2b] bg-[#0d0d12] hover:border-[#2a2a3a]'
          : 'border-[#1f1f2b] bg-[#15151d] hover:border-[#404d20] hover:bg-[#1c1c27]'}`}>
      {bloqueada
        ? <Lock aria-hidden className="w-3.5 h-3.5 text-[#6e6e80] flex-shrink-0" strokeWidth={2} />
        : <Icono nombre={a.icono} className="w-3.5 h-3.5 text-[#a3e635] flex-shrink-0" />}
      <span className="min-w-0 flex-1 text-[11px] leading-snug"
        style={{ color: bloqueada ? '#8f8f9f' : '#d4d4dd' }}>
        {a.label}
      </span>
      {a.estado === 'aviso' && (
        <AlertTriangle aria-hidden className="w-3 h-3 text-[#f59e0b] flex-shrink-0" strokeWidth={2} />
      )}
    </Link>
  )
}
