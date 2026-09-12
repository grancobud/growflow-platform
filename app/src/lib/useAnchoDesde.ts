// Si la ventana llega a cierto ancho.
//
// Vive en `lib` y no adentro de `Desplegable` por dos razones. Un archivo de
// componentes que además exporta un hook rompe el fast refresh de Vite —el
// módulo entero se recarga y el estado se pierde— y el lint lo marca. Y el
// corte lo necesita cualquiera, no sólo el desplegable.
//
// Existe además de `useIsMobile` porque ese corta en 768 y las clases `sm:` de
// Tailwind cortan en 640. Con el corte equivocado un panel que `sm:` muestra
// siempre quedaría clavado cerrado entre 640 y 768.

import { useCallback, useSyncExternalStore } from 'react'

/** El ancho de `sm:` en Tailwind. */
export const SM = 640

/**
 * `useSyncExternalStore` y no `useState` + `useEffect`: la media query ES un
 * store externo. Suscribirse en un efecto y copiar el valor con `setState`
 * deja una ventana entre el primer render y el efecto en la que el valor
 * puede haber cambiado, y obliga a un `setState` sincrónico adentro del
 * efecto para taparla.
 */
export function useAnchoDesde(px: number) {
  const consulta = `(min-width: ${px}px)`
  const suscribir = useCallback((avisar: () => void) => {
    const mql = window.matchMedia(consulta)
    mql.addEventListener('change', avisar)
    return () => mql.removeEventListener('change', avisar)
  }, [consulta])
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(consulta).matches,
    // En el render del servidor no hay ventana. Falso es el lado seguro: el
    // panel se dibuja como en el teléfono, y el primer render en el navegador
    // lo corrige.
    () => false,
  )
}
