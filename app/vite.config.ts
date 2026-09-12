import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    chunkSizeWarningLimit: 600,  // eleva el warning a 600KB (exceljs/bwip-js pesan mucho pero son lazy)
    rollupOptions: {
      output: {
        // Manual chunks para las libs mas pesadas — las separa en chunks dedicados
        // que se cachean aparte y se lazy-cargan solo cuando se usan.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          // REACT VA PRIMERO, ANTES QUE CUALQUIER LIBRERIA.
          //
          // Estaba al final y eso metia el runtime de JSX —que usa TODA la
          // app— adentro del chunk de la primera libreria que lo arrastrara.
          // Termino en `fullcalendar`: 236 KB que el navegador descargaba al
          // abrir la app, no porque hiciera falta el calendario sino porque
          // ahi habia quedado el `jsx-runtime`.
          //
          // Con la regla arriba, react y su runtime van a `react-core` y las
          // librerias pesadas quedan realmente aparte, que es para lo que se
          // separaron.
          // El `jsx-runtime` entra con un prefijo virtual de CommonJS
          // (`commonjs-proxy:…`), asi que el regex de `node_modules/react/`
          // no lo agarraba: por eso terminaba en el chunk de la primera libreria
          // que lo arrastrara. Se lo nombra aparte.
          if (id.includes('react/jsx-runtime') || id.includes('react/jsx-dev-runtime')) return 'react-core'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-core'
          // ExcelJS (~930KB): usado solo en export CoA/Trazabilidad/Importador
          if (id.includes('/exceljs/')) return 'exceljs'
          // bwip-js (~913KB): usado solo en EtiquetasQR (GS1 barcodes)
          if (id.includes('/bwip-js/')) return 'bwip-js'
          // PDF libs: pdf-lib + related usado en CoA Parser + cuaderno
          if (id.includes('/pdfjs-dist/') || id.includes('/pdf-lib/')) return 'pdf-libs'
          // ReactFlow (arbol visual): ~300KB
          if (id.includes('/reactflow/') || id.includes('@reactflow/')) return 'reactflow'
          // BPMN-js: usado solo en /procesos
          if (id.includes('/bpmn-js/') || id.includes('/diagram-js/')) return 'bpmn'
          // Nivo charts (sankey, heatmap): lazy en PaginaMetricas
          if (id.includes('/@nivo/')) return 'nivo'
          // FullCalendar NO lleva chunk propio a proposito.
          //
          // Lo tenia, y el resultado era el contrario del buscado: la pagina del
          // calendario es lazy, pero `@fullcalendar/react` arrastra el runtime de
          // JSX en CommonJS, y al forzarlo a un chunk aparte ese runtime —que usa
          // TODA la app— se iba con el. El navegador terminaba bajando 233 KB de
          // calendario al abrir el Panel. Sin la regla, rolldown lo deja en el
          // chunk de la pagina que lo usa, que es lo que corresponde.
          // Framer motion: usado en toda la app, dejarlo en vendor chunk
          if (id.includes('/framer-motion/')) return 'motion'
          // Libs de utilidad que suelen verse agrupadas si son amplias
          // LUCIDE TAMPOCO. Un chunk manual obliga a meter el paquete ENTERO:
          // eran 597 KB con los ~1500 iconos de la libreria para usar 198, y se
          // bajaban al arrancar. Sin la regla, el tree-shaking deja solo los que
          // se importan de verdad.
          if (id.includes('/date-fns/')) return 'date-fns'
          // Supabase client
          if (id.includes('/@supabase/')) return 'supabase'
          // TanStack (query, table, virtual)
          if (id.includes('/@tanstack/')) return 'tanstack'
          return undefined
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      // SW auto-destructivo: desinstala cualquier service worker viejo y limpia
      // sus caches en cuanto el navegador revalida /sw.js (headers no-cache).
      // Evita que la demo quede pegada en una version vieja sin tener que entrar
      // manualmente a /sw-killer. Sacrifica el modo offline (no critico en la demo).
      selfDestroying: true,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: null, // NO cachear index.html para evitar app bloqueada en version vieja
        globPatterns: ['**/*.{css,svg,png,ico}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'canntrace-assets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://sqdqvhjlmdweuuncwlfb.supabase.co',
            handler: 'NetworkFirst',
            options: { cacheName: 'canntrace-api', networkTimeoutSeconds: 5 },
          },
        ],
      },
      manifest: {
        name: 'GrowFlow · la asociación',
        short_name: 'GrowFlow la asociación',
        description: 'Trazabilidad de cultivo y gestion de la asociacion civil',
        theme_color: '#a3e635',
        background_color: '#0a0a0f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
