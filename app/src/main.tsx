// PRIMERO de todo, antes que nada que toque a Supabase.
//
// El enlace de invitación trae el token en el HASH, y el cliente de Supabase lo
// canjea por sesión y después LIMPIA el hash. Este módulo lee `type` al
// importarse: si se importara más abajo, para cuando corriera ya no habría nada
// que leer y la persona entraría con sesión y sin contraseña, sin que nada le
// avise. Ver `lib/enlaceDeAcceso.ts`.
import './lib/enlaceDeAcceso'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { queryClient } from './lib/queryClient'
import { setupPWA } from './lib/pwa'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/*
        MOVIMIENTO REDUCIDO, PARA TODA LA APP DE UNA VEZ.

        El CSS global ya frena las animaciones declaradas en CSS, pero
        framer-motion NO lo mira: anima desde JavaScript, escribiendo el
        `transform` en cada frame, y ninguna regla de hoja de estilos lo
        detiene. Habia nueve componentes animando asi —transiciones de
        pantalla, alertas, el chat, la botonera— y ninguno lo respetaba.

        `reducedMotion="user"` hace que framer siga la preferencia del sistema
        en todos ellos: apaga los cambios de posicion y escala, y deja pasar la
        opacidad. Es exactamente «menos y mas suave, no cero», y sobre todo va
        a valer para el proximo componente animado que alguien agregue, sin que
        tenga que acordarse.
      */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)

setupPWA()
