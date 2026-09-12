// El armazón de una fila que se toca. Sólo la caja: el contenido lo pone quien la usa.
//
// POR QUÉ EXISTE
//
// Esta misma fila —56px de alto, `rounded-lg`, borde `#2a2a3a` sobre `#15151d`,
// el hover que corre el borde a lima— se escribió TRES veces: en el Panel, en la
// portada de la O.N.G. y en las tarjetas de variedad de Cosecha. Las dos
// primeras se unificaron el 28/08/2026 y quedó `FilaAccion`; la tercera seguía
// aparte porque no es un link a una ruta sino un botón que abre un modal, y por
// eso `FilaAccion` no le servía.
//
// Esa es toda la diferencia, y no justifica un segundo diseño. Acá el armazón se
// escribe una vez y elige la etiqueta: `Link` si hay `to`, `button` si hay
// `onClick`. Lo de adentro lo decide cada pantalla, que es lo único que de
// verdad cambia entre una acción y una variedad.
//
// LA ALTURA LA DA EL CONTENIDO, Y LOS TÍTULOS SE ALINEAN. (30/08/2026)
//
// Antes eran 56px fijos con el contenido centrado. Con seis filas donde dos
// llevan una segunda línea —«Ojo: el recibo va a salir sin CUIT»— eso deja los
// títulos a alturas distintas dentro de cada fila: en la de un renglón el
// título cae en el centro de los 56; en la de dos, ocho píxeles más arriba.
// Todas las filas medían lo mismo y ninguna línea de texto coincidía con la de
// al lado. Es lo que se ve como «desbalanceado» al recorrer la lista de arriba
// abajo, aunque cada fila por separado esté perfecta.
//
// Ahora el contenido se alinea ARRIBA y el padding es explícito (12px), así que
// el título arranca siempre a la misma distancia del borde de su fila y la
// segunda línea cuelga. Las filas dejan de medir todas igual —una con dos
// renglones es más alta, que es la verdad— y a cambio la columna de títulos
// queda a plomo.
//
// El mínimo táctil de 44 se mantiene: con 12px arriba y abajo, una fila de un
// solo renglón mide 42 y el `min-h` la lleva a 44 sin dejar el texto pegado al
// borde, que era el motivo por el que antes hacían falta 56.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { presionFila } from '../../lib/ui'

// `h-full` con `w-full`: en una grilla de dos columnas, la tarjeta que trae el
// aviso naranja («Ojo: el recibo va a salir sin CUIT») es mas alta que la de al
// lado, y sin esto la fila queda despareja y con el fondo cortado a distinta
// altura. El alto de la celda lo iguala `auto-rows-fr` en la grilla; esto hace
// que la tarjeta lo OCUPE. Los dos hacen falta: uno solo no alcanza.
// `presionFila` reemplaza al `transition-colors` que estaba: agrega el hundido
// al tocar sin perder la transición de color. Es la fila más tocada de la app
// —las seis acciones de la portada y las variedades de Cosecha—, y en el
// teléfono era la que menos contestaba: el `hover:` de acá abajo no existe con
// el dedo, así que entre el toque y la pantalla nueva no pasaba nada.
const BASE = `flex items-start gap-2.5 px-3 py-3 min-h-[44px] h-full rounded-lg border ${presionFila} text-left w-full`
const VIVA = 'border-[#2a2a3a] bg-[#15151d] hover:border-[#404d20] hover:bg-[#1c1c27]'
const APAGADA = 'border-[#1f1f2b] bg-[#0d0d12] hover:border-[#2a2a3a]'

export function FilaTocable({ to, onClick, apagada = false, etiqueta, children }: {
  /** Adónde lleva. Excluyente con `onClick`. */
  to?: string
  /** Qué hace, cuando no lleva a ningún lado (abrir un modal, por ejemplo). */
  onClick?: () => void
  /** Para lo que no se puede hacer todavía: mismo tamaño, menos peso. */
  apagada?: boolean
  /** El `aria-label`, cuando el contenido visible no alcanza para entenderla. */
  etiqueta?: string
  children: ReactNode
}) {
  const clase = `${BASE} ${apagada ? APAGADA : VIVA}`
  return to
    ? <Link to={to} aria-label={etiqueta} className={clase}>{children}</Link>
    : <button type="button" onClick={onClick} aria-label={etiqueta} className={clase}>{children}</button>
}
