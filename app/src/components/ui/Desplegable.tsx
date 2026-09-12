// Lo que se abre y se cierra, sin el salto.
//
// POR QUÉ EXISTE
//
// Al abrir los filtros de Plantas la lista saltaba 104 px de golpe. Lo mismo la
// receta de Sala y el «ver todo» del Panel. Los tres estaban escritos igual:
// `hidden`/`flex` o `{abierto && …}`, que es aparecer, no abrirse. Sin el
// intermedio la vista de abajo se corre sin que se entienda por qué.
//
// EL INTENTO QUE NO FUNCIONÓ
//
// `grid-template-rows: 0fr → 1fr`, que es el truco de moda para animar altura
// desconocida. Acá el grid recortaba el contenido a cero: los filtros quedaban
// abiertos e invisibles. Se revirtió entero.
//
// Lo que sí funciona es medir. `ResizeObserver` da el alto real del contenido y
// el `max-height` se anima a ese número. Es más código, pero no depende de cómo
// resuelve el grid ni de que el contenido tenga una altura conocida, y sigue
// siendo correcto si el contenido cambia de tamaño con el panel abierto.
//
// DETALLES QUE PARECEN DE MÁS Y NO LO SON
//
// - `overflow: hidden` queda SIEMPRE. Es lo que recorta durante la animación, y
//   sacarlo al terminar obligaría a volver a ponerlo antes de cerrar. Los tres
//   usos de hoy tienen `<select>` nativos, que se dibujan fuera del documento y
//   no se recortan. Un popover absoluto adentro SÍ se recortaría.
// - La transición se declara SIEMPRE, no sólo mientras dura. Ponerla en el mismo
//   commit en que cambia el `max-height` no anima nada: para que una transición
//   arranque, la propiedad tiene que estar declarada en el estilo ANTERIOR al
//   cambio, y React escribe las dos cosas juntas. Medido: saltaba de 0 a 104 px
//   en el primer frame, exactamente igual que antes de todo esto.
// - Lo que sí se apaga es la primera pasada, con `listo`. Sin eso un panel que
//   arranca abierto se despliega solo al cargar la pantalla, y el `alto` que
//   entra por el `ResizeObserver` recién en el segundo frame lo animaría desde
//   cero.
// - Cerrado va `visibility: hidden`, que lo saca del orden de tabulación. Un
//   panel de alto cero con botones adentro se sigue pudiendo tabular: el foco
//   se va a un lugar que no se ve. Se pone cuando la transición TERMINA, no con
//   un temporizador: con `prefers-reduced-motion` la duración pasa a 0,01 ms y
//   un temporizador de 250 ms dejaría el panel tabulable un cuarto de segundo
//   después de cerrado.
// - La primera pasada no anima. Un panel que arranca abierto no tiene que
//   entrar animándose al cargar la pantalla.
//
// El movimiento reducido lo cubre el `prefers-reduced-motion` global de
// `index.css`, que pisa `transition-duration` en todo. Esto es CSS, no
// framer-motion, así que con eso alcanza.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { DURACION, EASE_CSS } from '../../lib/motion'

export function Desplegable({ abierto, sinRecorte = false, className = '', children }: {
  abierto: boolean
  /**
   * Se ve entero, sin animar ni recortar. Para los paneles que en pantalla
   * ancha están siempre abiertos: ahí no hay nada que desplegar.
   */
  sinRecorte?: boolean
  /**
   * Va en el div de adentro, el que se mide.
   *
   * Los márgenes quedan FUERA del alto medido, así que un `mt-2` acá recorta
   * esos ocho píxeles con el panel abierto. Para separar, padding.
   */
  className?: string
  children: ReactNode
}) {
  const contenido = useRef<HTMLDivElement>(null)
  const [alto, setAlto] = useState(0)
  /** Después del primer frame: antes no hay transición y nada se anima. */
  const [listo, setListo] = useState(false)

  // Fuera del orden de tabulación, pero recién cuando terminó de cerrarse.
  // Se ajusta durante el render y no en un efecto: es estado derivado de
  // `abierto`, y hacerlo en un efecto pinta un frame con el valor viejo.
  const [oculto, setOculto] = useState(!abierto)
  const [previo, setPrevio] = useState(abierto)
  if (abierto !== previo) {
    setPrevio(abierto)
    if (abierto) setOculto(false)
  }

  useLayoutEffect(() => {
    const el = contenido.current
    if (!el) return
    // `offsetHeight` y no `contentRect`: el segundo es la caja de contenido y
    // deja afuera el padding del propio div.
    const medir = () => setAlto(el.offsetHeight)
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    medir()
    const f = requestAnimationFrame(() => setListo(true))
    return () => { ro.disconnect(); cancelAnimationFrame(f) }
  }, [])

  if (sinRecorte) return <div className={className}>{children}</div>

  return (
    <div
      aria-hidden={!abierto}
      onTransitionEnd={e => {
        // Sólo la del panel: una transición de un botón de adentro burbujea
        // hasta acá y escondería el panel abierto.
        if (e.target === e.currentTarget && e.propertyName === 'max-height' && !abierto) setOculto(true)
      }}
      style={{
        overflow: 'hidden',
        maxHeight: abierto ? alto : 0,
        visibility: oculto ? 'hidden' : undefined,
        transition: listo ? `max-height ${DURACION.entrada}s ${EASE_CSS}` : undefined,
      }}
    >
      <div ref={contenido} className={className}>{children}</div>
    </div>
  )
}
