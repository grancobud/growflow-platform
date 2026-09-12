// Registro del service worker con prompt de actualizacion via sonner.
// VitePWA usa workbox con skipWaiting + clientsClaim + cleanupOutdatedCaches (vite.config.ts).
// index.html y manifest.webmanifest NO se cachean (navigateFallback: null + _headers no-cache).

import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

export function setupPWA() {
  // En dev SW queda desactivado (devOptions.enabled = false en vite.config.ts)
  if (import.meta.env.DEV) return

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast('Nueva version disponible', {
        description: 'Recarga para aplicar cambios',
        duration: Infinity,
        action: {
          label: 'Recargar',
          onClick: () => updateSW(true),
        },
      })
    },
    onOfflineReady() {
      toast.success('App lista para uso offline', {
        description: 'Los datos pesados quedaran en cache',
      })
    },
    onRegisterError(error) {
      console.error('SW registration error:', error)
    },
  })
}
