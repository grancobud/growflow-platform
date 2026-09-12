// Guard de ruta por permiso.
//
// Ocultar la seccion del menu no alcanza: la URL sigue existiendo y quien la
// escriba a mano entra igual. Los datos no se filtran —eso lo corta el RLS de
// Postgres— pero la pantalla se veria vacia y parece rota, no restringida.
//
// Este componente responde lo segundo: dice por que no se puede entrar, en vez
// de mostrar una pantalla en blanco.

import { Navigate } from 'react-router-dom'
import { ShieldOff, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function RutaConPermiso({ permiso, children }: {
  permiso: string
  children: React.ReactNode
}) {
  const { cargando, autenticado, tienePermiso, usuario } = useAuth()

  if (cargando) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[#a3e635]" aria-label="Cargando" />
    </div>
  )
  if (!autenticado) return <Navigate to="/login" replace />
  if (tienePermiso(permiso)) return <>{children}</>

  // Un perfil sin activar es el caso mas comun aca: el usuario se creo pero
  // todavia nadie le dio el rol. Merece un mensaje distinto al de "no te
  // corresponde", porque la accion a tomar es otra.
  const sinActivar = !usuario?.rol || usuario.activo === false

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0f] px-6 py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-[#15151d] border border-[#2a2a3a] flex items-center justify-center mb-4">
          <ShieldOff className="w-5 h-5 text-[#8a8a9c]" strokeWidth={1.8} />
        </div>
        <h2 className="font-display font-semibold text-[16px] text-[#ececf1]">
          {sinActivar ? 'Tu cuenta todavía no está habilitada' : 'Esta sección no está en tu perfil'}
        </h2>
        <p className="text-[12px] text-[#8a8a9c] mt-2 leading-relaxed">
          {sinActivar
            ? 'Un administrador tiene que activarla y asignarte un rol. Mientras tanto no vas a ver datos del sistema.'
            : `Entraste como ${usuario?.rol?.replace('_', ' ')}. Si necesitás acceso a esta parte, pedíselo a un administrador.`}
        </p>
      </div>
    </div>
  )
}
