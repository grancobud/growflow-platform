import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GuiaAlLlegar } from '../GuiaAlLlegar'
import { BarraFlujo } from '../ong/BarraFlujo'

/**
 * Page transition wrapper.
 * Envuelve Outlet en AnimatePresence para animar cambios de ruta.
 * Fade + subtle y-offset clinical-refined (no bounce).
 */
export default function PageTransition() {
  const location = useLocation()
  const [params] = useSearchParams()
  // La barra de flujo, para los flujos que salen de la O.N.G.
  //
  // `PaginaONG` dibuja la suya con `datos` cargados, asi que sus pasos se
  // marcan solos como «ya hecho». Fuera de ahi esos datos no existen —y
  // cargarlos en el layout haria mas lenta cada pantalla de la app por algo que
  // se usa a veces— asi que va sin ellos: dice que paso es, por que, y como
  // seguir, que es lo que hace falta para no quedarse colgado.
  //
  // Se dibuja SOLO fuera de /ong. Adentro la pone PaginaONG y saldrian dos.
  //
  // Existe porque `cosechar` tiene sus tres pasos en Cultivo. Sin esto, quien
  // tocaba la tarjeta del Panel aterrizaba en Geneticas sin barra: sin saber que
  // paso era, sin el «por que» y sin el boton para seguir.
  const enOng = location.pathname.startsWith('/ong') || location.pathname === '/registro'

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }}
        // `min-h-0` NO es decorativo: sin él la página no se puede scrollear.
        //
        // Un flex item en columna trae `min-height: auto`, que le impide
        // encogerse por debajo de su contenido. Con `overflow-hidden` encima, el
        // hijo que tiene el `overflow-y-auto` crece hasta el alto del contenido
        // —medido en Plantas: 17.196 px— en vez de quedar acotado a la ventana.
        // Resultado: nadie scrollea, y este `overflow-hidden` recorta todo lo
        // que pasa de los 776 px visibles.
        //
        // Lo peor es cómo se esconde: `scrollIntoView()` y `scrollTop` SIGUEN
        // funcionando con `overflow: hidden`, así que cualquier verificación
        // automatizada recorre la página entera y no ve nada raro. Con el dedo
        // no se puede bajar. `Layout.tsx` ya lo tenía en su `<main>`; acá
        // faltaba, y este envoltorio es el que quedó en el medio.
        className="flex-1 flex flex-col min-h-0 overflow-hidden min-w-0"
      >
        <GuiaAlLlegar />
        {!enOng && (
          <div className="px-3 sm:px-6 pt-3">
            <BarraFlujo flujoId={params.get('flujo')} pasoCrudo={params.get('paso')} />
          </div>
        )}
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}
