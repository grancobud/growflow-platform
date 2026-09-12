// Barra de pestañas para las pantallas que agrupan varias vistas bajo un solo
// item de menú (Cultivo, Instalación).
//
// Dos decisiones que hacen que funcione sin tocar las páginas que agrupa:
//
// 1. La sección sale del pathname, no de un useState. Así las URLs viejas
//    siguen andando, los links internos entre secciones no se rompen y se puede
//    compartir o marcar una vista concreta.
// 2. La barra va FUERA del área que scrollea. Cada página conserva adentro su
//    propio header sticky con sus controles y no hay dos barras peleando por
//    el top.

import { Suspense, type ComponentType } from 'react'
import { NavLink, useLocation, Navigate } from 'react-router-dom'
import { Loader2, type LucideIcon } from 'lucide-react'
import { useDesbordeHorizontal } from '../../lib/useDesbordeHorizontal'

export interface Seccion {
  ruta: string
  label: string
  icono: LucideIcon
  Vista: ComponentType
}

export function PestanasSeccion({ secciones, etiqueta }: {
  secciones: readonly Seccion[]
  /** Para el aria-label del nav; describe el grupo, no la pestaña activa. */
  etiqueta: string
}) {
  const { pathname } = useLocation()
  // Antes del return condicional de abajo: un hook no puede quedar detrás de un
  // early return.
  const { refWrapper, refScroller } = useDesbordeHorizontal<HTMLDivElement, HTMLElement>(secciones.length)
  // POR SEGMENTO, NO POR PREFIJO DE STRING.
  //
  // Con `startsWith` a secas, `/plantas` empieza con `/plan` — asi que al sumar
  // la seccion del plan de cultivo, entrar a Plantas mostraba el Plan con la
  // URL diciendo `/plantas`. Una pantalla que no es la que pediste y una URL
  // que jura que si.
  //
  // No es un caso raro ni buscado: pasa cada vez que una ruta nueva es prefijo
  // de una vieja, y el orden del arreglo decide cual gana. Comparar por
  // segmento lo saca del azar.
  const esLaSeccion = (ruta: string) => pathname === ruta || pathname.startsWith(ruta + '/')
  const actual = secciones.find(s => esLaSeccion(s.ruta))

  // SIN SECCIONES NO SE DIBUJA NADA, y esto no es defensivo de mas: paso.
  //
  // Al agrupar el modulo agronomico las secciones pasaron a filtrarse por
  // permiso, y `tienePermiso` contesta que no mientras el usuario todavia se
  // esta cargando. Con la lista vacia el `Navigate` de abajo leia
  // `secciones[0].ruta` y tiraba la pantalla entera al ErrorBoundary — pantalla
  // en negro y «Cannot read properties of undefined».
  //
  // Un componente que recibe una lista no puede reventar con la lista vacia,
  // aunque hoy el unico que se la pase vacia sea un caso de carrera.
  if (secciones.length === 0) return null

  // La ruta contenedora (/agronomico, /cultivo) cae en la primera vista.
  if (!actual) return <Navigate to={secciones[0].ruta} replace />
  const { Vista } = actual

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0a0a0f]">
      <div ref={refWrapper} className="ct-tabs-fade flex-shrink-0 border-b border-[#1f1f2b] bg-[#0a0a0f]">
        <nav aria-label={etiqueta} ref={refScroller}
          // Mismo criterio que `BarraPestanas`: el padding de la página menos el del
          // botón, para que el texto de la primera pestaña arranque donde arranca
          // el contenido. Con `px-2 sm:px-4` y botones de `px-3` el texto caía en
          // 20 px, contra los 12 del título y los 16 de la otra barra: tres
          // márgenes izquierdos distintos en la misma pantalla.
          className="scrollbar-none flex gap-1 px-0 sm:px-3 overflow-x-auto">
          {secciones.map(({ ruta, label, icono: Ic }) => (
            <NavLink key={ruta} to={ruta}
              className={({ isActive }) =>
                `flex items-center gap-1.5 whitespace-nowrap px-3 py-3 min-h-[44px] text-[12px] font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-[#a3e635] text-[#d9f99d]'
                    : 'border-transparent text-[#8f8f9f] hover:text-[#d4d4dd]'}`}>
              <Ic className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#8a8a9c]" aria-label="Cargando" />
        </div>
      }>
        <Vista />
      </Suspense>
    </div>
  )
}
