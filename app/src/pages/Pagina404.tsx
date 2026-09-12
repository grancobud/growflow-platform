import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Search, FileQuestion, ArrowRight } from 'lucide-react'
import { Marca } from '../components/Marca'

/**
 * 404 Not Found.
 * Ruta * catch-all. Diseno clinical-refined con CTAs claros.
 */
export default function Pagina404() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/40 to-accent-50/20 dark:from-surface-950 dark:via-primary-900/20 dark:to-accent-900/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
        className="max-w-md text-center"
      >
        {/* Usa <Marca>, que es donde vive la identidad de ESTA instalacion.
            Antes tenia el logo y el nombre de CannTrace escritos a mano —
            marca de otro producto y de otra consultora— porque este repo
            salio de ahi y la 404 quedo sin migrar. Se ve al errarle a un
            link, que es justo cuando uno mira que aplicacion abrio. */}
        <Link to="/" className="inline-flex mb-8 group" aria-label="Volver al inicio">
          <Marca tamano="md" />
        </Link>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="w-20 h-20 bg-accent-100 dark:bg-accent-900/40 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <FileQuestion className="w-10 h-10 text-accent-700 dark:text-accent-300" />
        </motion.div>

        <h1 className="font-display text-5xl sm:text-6xl font-bold text-surface-900 dark:text-white tracking-tight tabular-nums">
          404
        </h1>
        <p className="mt-3 text-lg font-display text-surface-700 dark:text-surface-200">
          Lote no encontrado
        </p>
        <p className="mt-2 text-sm text-surface-500 dark:text-surface-400 max-w-sm mx-auto leading-relaxed">
          La ruta que buscas no existe o el codigo de trazabilidad no esta en nuestro sistema.
          Verifica el enlace o vuelve al inicio.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-medium shadow-lg shadow-primary-700/20 transition hover:-translate-y-0.5"
          >
            <Home className="w-4 h-4" />
            Inicio
          </Link>
          <Link
            to="/docs"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white font-medium hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          >
            <Search className="w-4 h-4" />
            Documentacion
          </Link>
          <Link
            to="/contacto"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-primary-700 dark:text-primary-400 font-medium hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
          >
            Contacto
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="mt-12 text-xs text-surface-500 dark:text-surface-500">
          GrowFlow · la asociación
        </div>
      </motion.div>
    </div>
  )
}
