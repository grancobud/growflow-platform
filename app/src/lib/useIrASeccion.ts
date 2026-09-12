// Lleva a una sección puntual de una pantalla larga.
//
// Una guía que deja en la pantalla correcta pero fuera de vista resuelve la
// mitad del problema. El paso «el pago al proveedor» cae en Seguimiento, y el
// Libro Diario de Caja es la tercera sección de esa pantalla: al cerrar el
// formulario quedabas arriba, mirando el panel del Director Médico, sin ninguna
// señal de que lo que buscabas estaba más abajo.
//
// Con `?ir=caja` la sección se trae a la vista al llegar.

import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { limpiarParametro } from './limpiarParametro'

/** Cuánto esperar a que la sección exista, y cada cuánto volver a mirar. */
const INTENTOS = 20
const CADA_MS = 150

export function useIrASeccion() {
  const { search, pathname } = useLocation()
  const navegar = useNavigate()
  const yaFue = useRef(false)

  useEffect(() => {
    if (yaFue.current) return
    const id = new URLSearchParams(search).get('ir')
    if (!id) return
    yaFue.current = true

    limpiarParametro('ir', navegar, pathname)

    // Se espera a que la sección exista en vez de scrollear a ciegas.
    //
    // La pantalla llega con un spinner y trae sus datos después, así que en el
    // primer frame la sección todavía no está: un `scrollIntoView` con un
    // timeout fijo se ejecutaba contra la nada y la página se quedaba arriba.
    //
    // Se reintenta durante tres segundos y se abandona. Si en ese tiempo no
    // apareció, algo más está mal y saltar de golpe cuando termine de cargar
    // sería peor que no hacerlo.
    let intentos = 0
    const timer = window.setInterval(() => {
      const el = document.getElementById(id)
      if (el) {
        // `auto` y no `smooth`: el desplazamiento animado se cancela solo
        // cuando hay un modal abierto encima, que es justo el caso —la guia
        // abre el formulario y scrollea detras—. Ademas llegar de una es menos
        // desorientador que ver la pagina deslizarse dos segundos.
        el.scrollIntoView({ behavior: 'auto', block: 'start' })
        window.clearInterval(timer)
        return
      }
      if (++intentos >= INTENTOS) window.clearInterval(timer)
    }, CADA_MS)

    // El cleanup NO cancela el intervalo, y es a propósito: `limpiarParametro`
    // cambia la URL, la URL está en las dependencias, y React corre el cleanup
    // del efecto anterior antes del siguiente. Cancelar ahí mataba el scroll
    // antes de que ocurriera, que fue exactamente lo que pasó la primera vez.
    // El propio intervalo se corta solo, por hallazgo o por límite.
  }, [search, pathname, navegar])
}
