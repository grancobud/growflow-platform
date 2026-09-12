// El Header abre y cierra el panel lateral por una funcion global, porque los
// dos componentes no comparten arbol. Se DECLARA en vez de castear a `any`: asi
// el compilador sabe la firma y avisa si alguno de los dos lados cambia.
declare global {
  interface Window { __toggleSidebar?: () => void }
}

import { Suspense, useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader2, Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import PageTransition from './PageTransition'
import { useDialogo } from '../../lib/useDialogo'

const KEY_WIDTH = 'canntrace_sidebar_px'
const WIDTH_DEFAULT = 240
const WIDTH_MIN = 140
const WIDTH_MAX = 380
const WIDTH_COLLAPSED = 64

function loadWidth(): number {
  try {
    const v = localStorage.getItem(KEY_WIDTH)
    if (v) {
      const n = parseInt(v)
      if (!isNaN(n)) return n
    }
  } catch { /* localStorage puede tirar en modo privado; el ancho del panel es una comodidad, no un dato */ }
  return WIDTH_DEFAULT
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  // El menu lateral de celular es lo primero que se cierra con el atras.
  const refDialogo = useDialogo(() => setMobileOpen(false), mobileOpen)
  const [isMobile, setIsMobile] = useState(false)
  const [width, setWidth] = useState<number>(loadWidth)
  const [drag, setDrag] = useState(false)
  const startX = useRef(0)
  const startW = useRef(WIDTH_DEFAULT)
  const location = useLocation()

  // Cerrar el cajón mobile al navegar a otra sección.
  //
  // La regla `set-state-in-effect` avisa de los efectos que encadenan renders, y
  // tiene razón como heurística. Este es el caso que la regla no distingue:
  // reaccionar a que la RUTA cambió, que es un evento externo al render.
  //
  // La alternativa —cerrarlo en el onClick de cada link— deja el cajón abierto
  // en toda navegación que no sea un click: el botón atrás del teléfono, un
  // `navigate()` de un flujo, una redirección por permiso. Se prefiere el
  // efecto, que cubre todas.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Toggle global para Header
  useEffect(() => {
    window.__toggleSidebar = () => {
      if (isMobile) return setMobileOpen(o => !o)
      setWidth(w => {
        const next = w <= WIDTH_COLLAPSED + 10 ? WIDTH_DEFAULT : WIDTH_COLLAPSED
        try { localStorage.setItem(KEY_WIDTH, String(next)) } catch { /* localStorage puede tirar en modo privado; el ancho del panel es una comodidad, no un dato */ }
        return next
      })
    }
  }, [isMobile])

  // Ctrl+B / Cmd+B colapsa/expande el sidebar (Claude-style)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        // No interferir en inputs/textarea
        const tgt = e.target as HTMLElement | null
        if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return
        e.preventDefault()
        ;window.__toggleSidebar?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Drag handlers
  useEffect(() => {
    if (!drag) return
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX.current
      let w = startW.current + delta
      // Snap a colapsado si viene muy chico
      if (w < WIDTH_MIN - 20) w = WIDTH_COLLAPSED
      else if (w < WIDTH_MIN) w = WIDTH_MIN
      if (w > WIDTH_MAX) w = WIDTH_MAX
      setWidth(w)
    }
    const onUp = () => {
      setDrag(false)
      setWidth(w => { try { localStorage.setItem(KEY_WIDTH, String(w)) } catch { /* localStorage puede tirar en modo privado; el ancho del panel es una comodidad, no un dato */ }; return w })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [drag])

  // Mobile: overlay drawer + bottom nav
  if (isMobile) {
    return (
      <div className="flex h-[100dvh] overflow-hidden bg-primary-100 dark:bg-surface-950">
        {mobileOpen && (
          <div ref={refDialogo} className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="relative w-64 h-full bg-surface-900 overflow-y-auto pt-[env(safe-area-inset-top)]">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 text-white p-1 z-10 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Cerrar menu"
              >
                <X className="w-5 h-5" />
              </button>
              <Sidebar colapsado={false} />
              <div className="px-3 pb-4">
                <button onClick={() => setMobileOpen(false)}
                  className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-surface-300 dark:border-surface-700 text-[12px] text-surface-600 dark:text-surface-300 hover:bg-surface-200/60 dark:hover:bg-surface-800">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] bg-surface-900 text-white">
            {/* 44x44 minimo para el dedo. El -ml-1.5 compensa el padding extra
                para que el icono siga alineado con el borde del contenedor. */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="-ml-1.5 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Abrir menu completo"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-bold">GrowFlow</span>
          </div>
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-600" aria-label="Cargando" /></div>}>
            <PageTransition />
          </Suspense>
        </div>
      </div>
    )
  }

  // Desktop: flex con drag manual
  const colapsado = width <= WIDTH_COLLAPSED + 10
  return (
    /* `100dvh` y no `h-screen`, que es `100vh`.
       En Safari de iOS `100vh` cuenta el alto CON la barra de direcciones
       retraida, asi que la ultima franja del contenido queda tapada por ella.
       La rama de arriba —la de mobile— ya usaba `dvh`; esta no, y `isMobile`
       corta en 768px: un telefono ACOSTADO mide 844 y cae por aca, o sea que el
       recorte aparecia justo al girar el telefono para ver una tabla.
       En escritorio `dvh` y `vh` valen lo mismo: no hay barra que se mueva. */
    <div className="flex h-[100dvh] overflow-hidden bg-[#0a0a0f]">
      {/* Skip link para accesibilidad - oculto hasta focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[999] focus:px-4 focus:py-2 focus:bg-primary-700 focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Saltar al contenido
      </a>
      {/* Estilos resizer Claude-style (handoff Claude Design v2). Aislados al divider. */}
      <style>{`
        /* Ocultar scrollbar fea del sidebar nav (mantiene scroll funcional) */
        .ct-sidebar-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .ct-sidebar-nav::-webkit-scrollbar { width: 0; height: 0; display: none; }
        .ct-resizer { position: relative; width: 10px; flex-shrink: 0; cursor: col-resize; user-select: none; touch-action: none; z-index: 30; background: #0a0a0f; }
        .ct-resizer-line { position: absolute; top: 0; bottom: 0; left: 50%; transform: translateX(-50%); width: 1px; background: #15151d; transition: background 160ms ease, width 160ms ease; }
        .ct-resizer:hover .ct-resizer-line, .ct-resizer.is-dragging .ct-resizer-line { background: #a3e635; width: 2px; }
        .ct-resizer-grip { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 4px; height: 40px; border-radius: 4px; background: #2a2a3a; opacity: 0; transition: opacity 160ms ease, background 160ms ease, transform 160ms ease; pointer-events: none; }
        .ct-resizer:hover .ct-resizer-grip, .ct-resizer.is-dragging .ct-resizer-grip { opacity: 1; background: #bef264; transform: translate(-50%,-50%) scaleY(1.15); }
        .ct-resizer-tooltip { position: absolute; top: 50%; left: calc(50% + 14px); transform: translateY(-50%); white-space: nowrap; background: #101016; border: 1px solid #1f1f2b; color: #d4d4dd; font-size: 11.5px; padding: 6px 9px; border-radius: 6px; opacity: 0; pointer-events: none; transition: opacity 180ms ease 120ms; box-shadow: 0 6px 24px rgba(0,0,0,.4); line-height: 1.35; }
        .ct-resizer-tooltip .kbd { display: inline-flex; align-items: center; margin-left: 8px; padding: 1px 5px; border-radius: 3px; background: #1f1f2b; border: 1px solid #2a2a3a; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; color: #8f8f9f; }
        .ct-resizer:hover .ct-resizer-tooltip { opacity: 1; }
        .ct-resizer.is-dragging .ct-resizer-tooltip { opacity: 0; }
        aside[data-ct-sidebar] { transition: width 260ms cubic-bezier(0.22, 1, 0.36, 1); }
        aside[data-ct-sidebar][data-dragging="true"] { transition: none; }
      `}</style>
      <aside data-ct-sidebar data-dragging={drag} style={{ width }} className="bg-[#0a0a0f] flex-shrink-0 overflow-hidden" aria-label="Navegacion principal">
        <Sidebar colapsado={colapsado} />
      </aside>
      {/* Divider Claude-style: line + grip + tooltip */}
      <div
        onMouseDown={(e) => { startX.current = e.clientX; startW.current = width; setDrag(true) }}
        onDoubleClick={() => { setWidth(WIDTH_DEFAULT); try { localStorage.setItem(KEY_WIDTH, String(WIDTH_DEFAULT)) } catch { /* localStorage puede tirar en modo privado; el ancho del panel es una comodidad, no un dato */ } }}
        className={`ct-resizer ${drag ? 'is-dragging' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar sidebar"
      >
        <div className="ct-resizer-line" />
        <div className="ct-resizer-grip" />
        <div className="ct-resizer-tooltip">
          {colapsado ? 'Expandir' : 'Contraer'} sidebar<span className="kbd">Ctrl+B</span>
        </div>
      </div>
      <main id="main-content" className="flex-1 flex flex-col min-h-0 overflow-hidden min-w-0" tabIndex={-1}>
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-600" aria-label="Cargando" /></div>}>
          <PageTransition />
        </Suspense>
      </main>
    </div>
  )
}
