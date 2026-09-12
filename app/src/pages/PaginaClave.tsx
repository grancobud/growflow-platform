// PaginaClave — definir la contraseña la primera vez, o después de olvidarla.
//
// Es lo que faltaba para que invitar a alguien sirviera de algo. El enlace de
// invitación deja a la persona CON SESION y SIN CONTRASEÑA: entra una vez y no
// puede volver a entrar nunca. Acá elige su clave y recién después pasa.
//
// No pide la clave anterior: quien llega por invitación no tiene ninguna, y
// quien llega por recuperación tampoco se acuerda. Lo que autoriza es el enlace,
// que ya se canjeó por sesión antes de llegar acá.

import { useState } from 'react'
import { Lock, Eye, EyeOff, Check } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { Marca } from '../components/Marca'
import { btnPrimario } from '../lib/ui'
import { TIPO_DE_ENLACE } from '../lib/enlaceDeAcceso'
import { loQueFaltaEnLaClave } from '../lib/clave'

export default function PaginaClave({ onListo }: { onListo: () => void }) {
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [ver, setVer] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const falta = loQueFaltaEnLaClave(clave, repetida)
  // No se le grita antes de que escriba nada: el aviso aparece cuando ya empezó.
  const aviso = clave.length > 0 && repetida.length > 0 ? falta : null

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (falta) return
    setGuardando(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: clave })
      if (error) throw new Error(error.message)
      // Quien llega por invitación no pasa NUNCA por el login la primera vez:
      // el enlace ya le dio sesión. Sin esto, su ficha diría «nunca entró»
      // hasta la segunda vez que entre, que es justo cuando ya no importa.
      supabase.rpc('marcar_acceso').then(() => {}, () => {})
      toast.success('Listo, ya podés entrar con esa clave')
      onListo()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const campo = 'w-full min-h-[44px] pl-9 pr-10 rounded-lg bg-[#15151d] border border-[#2a2a3a] ' +
    'text-[13px] text-[#ececf1] placeholder:text-[#8a8a9c] focus:border-[#404d20] focus:outline-none'

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-[#d4d4dd] flex items-center justify-center p-5 font-sans">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-7"><Marca tamano="md" /></div>

        <h1 className="text-[17px] font-medium text-[#ececf1]">
          {TIPO_DE_ENLACE === 'recovery' ? 'Elegí una clave nueva' : 'Definí tu contraseña'}
        </h1>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[#a6a6b5]">
          {TIPO_DE_ENLACE === 'recovery'
            ? 'La anterior deja de servir apenas guardes ésta.'
            : 'Es la que vas a usar para entrar de acá en adelante. Sin esto, el enlace ' +
              'que te trajo sirve una sola vez.'}
        </p>

        <form onSubmit={guardar} className="mt-5 space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8a8a9c]" />
            <input
              type={ver ? 'text' : 'password'} value={clave} autoFocus
              onChange={e => setClave(e.target.value)}
              placeholder="Tu contraseña" autoComplete="new-password" className={campo}
            />
            <button
              type="button" onClick={() => setVer(v => !v)}
              aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#8a8a9c] hover:text-[#ececf1]"
            >
              {ver ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="relative">
            <Check className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8a8a9c]" />
            <input
              type={ver ? 'text' : 'password'} value={repetida}
              onChange={e => setRepetida(e.target.value)}
              placeholder="Repetila" autoComplete="new-password" className={campo}
            />
          </div>

          {aviso && <p className="text-[11px] text-[#f0a5a5]">{aviso}</p>}

          <button type="submit" disabled={!!falta || guardando} className={`${btnPrimario} w-full`}>
            {guardando ? 'Guardando…' : 'Guardar y entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
