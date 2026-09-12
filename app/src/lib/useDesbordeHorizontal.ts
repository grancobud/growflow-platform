// Enciende los degradados de los costados de una barra scrolleable.
//
// Va junto con `.ct-tabs-fade` de index.css. Los degradados reemplazan a la barra
// de scroll del navegador, que ocupaba 15 px y estaba siempre, aun cuando entraba
// todo. Estos aparecen sólo del lado donde queda algo fuera de vista.
//
// Devuelve DOS refs a propósito. El degradado tiene que ir en un wrapper que no
// scrollee: un absolute con right:0 adentro del propio overflow-x:auto se ancla
// al final del contenido en vez del borde visible, y termina fuera de cuadro.

import { useRef, useEffect, useCallback } from 'react'

export function useDesbordeHorizontal<W extends HTMLElement, S extends HTMLElement>(
  dependencia?: unknown,
) {
  const refWrapper = useRef<W>(null)
  const refScroller = useRef<S>(null)

  // Se escribe en el DOM por atributo en vez de guardar estado: esto corre en
  // cada píxel de scroll, y un setState por evento rerenderizaría la barra entera.
  const marcar = useCallback(() => {
    const el = refScroller.current
    const wrap = refWrapper.current
    if (!el || !wrap) return
    const max = el.scrollWidth - el.clientWidth
    wrap.dataset.hayIzq = el.scrollLeft > 4 ? '1' : '0'
    wrap.dataset.hayDer = el.scrollLeft < max - 4 ? '1' : '0'
  }, [])

  useEffect(() => {
    const el = refScroller.current
    if (!el) return
    marcar()
    el.addEventListener('scroll', marcar, { passive: true })
    // Sin el observer, achicar la ventana dejaba el degradado apagado con
    // pestañas ya fuera de vista.
    const ro = new ResizeObserver(marcar)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', marcar); ro.disconnect() }
  }, [marcar, dependencia])

  return { refWrapper, refScroller }
}
