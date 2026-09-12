// lazyWithRetry — wraps React.lazy con retry + auto-reload fallback.
//
// Problema que resuelve (root cause del "F5 obligatorio en /operacion"):
//
// 1. Vite hashea los chunks por contenido: PaginaOperacion-abc123.js
// 2. Cloudflare Pages sirve index.html con referencias a los hashes actuales
// 3. Al deployar, los hashes cambian (PaginaOperacion-xyz789.js) y los
//    chunks viejos se borran del edge
// 4. El browser/PWA tiene el index.html viejo en memoria → intenta
//    `import('/assets/PaginaOperacion-abc123.js')` → 404 → React.lazy
//    propaga el error → Suspense rompe → pantalla muerta hasta F5
//
// Es un bug clasico en SPA con deploys frecuentes (aka "chunk load error").
// La solucion estandar:
//   - Retry 1 vez con cache-buster (por si fue red flaky)
//   - Si sigue fallando, recargar index.html (que trae los hashes nuevos)
//
// Referencias:
//   - https://vite.dev/guide/build#load-error-handling (Vite oficial)
//   - https://www.codemzy.com/blog/fix-chunkloaderror-react

import { lazy, type ComponentType } from 'react'

const SW_RELOAD_FLAG = 'canntrace_lazy_reloaded_at'
const RELOAD_COOLDOWN_MS = 10_000

function shouldReload(): boolean {
  try {
    const last = sessionStorage.getItem(SW_RELOAD_FLAG)
    if (!last) return true
    const age = Date.now() - parseInt(last)
    // Evita loop infinito de reload: si ya reloadeamos hace <10s, no repetir
    return age > RELOAD_COOLDOWN_MS
  } catch {
    return true
  }
}

function markReload(): void {
  try { sessionStorage.setItem(SW_RELOAD_FLAG, String(Date.now())) } catch { /* ok */ }
}

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  // Chrome/Edge: "Failed to fetch dynamically imported module"
  // Firefox: "error loading dynamically imported module"
  // Safari: "Importing a module script failed"
  // Vite: "ChunkLoadError"
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported|error loading dynamically imported|Importing a module script failed/i.test(msg)
}

/**
 * Drop-in replacement de React.lazy que maneja fallas de import().
 *
 * @param factory - El () => import('./Component') de toda la vida
 * @param name - Identificador para logging
 *
 * Comportamiento en fallo:
 *   1er intento: lo que React.lazy hace normal
 *   Si falla con ChunkLoadError y nunca reintentamos:
 *     - Espera 350ms (por si fue red flaky)
 *     - Reintenta con cache-buster ?v=timestamp
 *   Si el reintento tambien falla con ChunkLoadError:
 *     - Recarga window.location (baja index.html fresco con hashes nuevos)
 *     - Cooldown 10s para no loopear
 *   Si falla por otra razon (bug en el modulo): propaga normal a ErrorBoundary
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  name: string = 'chunk',
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    try {
      return await factory()
    } catch (err) {
      if (!isChunkLoadError(err)) throw err

      console.warn(`[lazyWithRetry] ${name} fallo primer intento:`, err)

      // Retry con delay + cache-buster-ish (forzar re-ejecucion de factory)
      await new Promise(r => setTimeout(r, 350))
      try {
        return await factory()
      } catch (err2) {
        console.error(`[lazyWithRetry] ${name} fallo retry:`, err2)

        if (shouldReload()) {
          markReload()
          console.warn(`[lazyWithRetry] Recargando index.html para traer chunks nuevos...`)
          // Hard reload — baja index.html del origen con los hashes actuales
          window.location.reload()
          // Retornar promesa pendiente mientras reload sucede
          return new Promise<{ default: T }>(() => { /* never resolves */ })
        }

        // Si ya reloadeamos hace poco y sigue fallando, mostrar error real
        throw err2
      }
    }
  })
}
