// PaginaLogin — version personal: split-screen dark, sin compliance ni roles.

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, LogIn, Sprout, Droplets, FileText, AlertTriangle } from 'lucide-react'
import { EASE, DURACION } from '../lib/motion'
import { Marca } from '../components/Marca'
import { ENLACE_VENCIDO, ENLACE_FALLIDO, MOTIVO_DEL_ERROR } from '../lib/enlaceDeAcceso'


const FEATURES = [
  { icono: Sprout, color: '#bef264', texto: 'Genéticas, plantas y fases en un solo lugar' },
  { icono: Droplets, color: '#38bdf8', texto: 'Riegos, podas y cosechas con un click' },
  { icono: FileText, color: '#c4b5fd', texto: 'Pacientes, entregas y libros de la asociación' },
]

interface Props { onLogin: (email: string, password: string) => Promise<void> }

export default function PaginaLogin({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setCargando(true); setError('')
    // Atajo opcional: si VITE_LOGIN_ALIAS esta configurado (ej "admin:admin"),
    // ese usuario/clave cortos mapean a las credenciales reales de Supabase
    // (GoTrue exige formato email y password de 6+ caracteres).
    const alias = import.meta.env.VITE_LOGIN_ALIAS || ''
    const aliasEmail = import.meta.env.VITE_LOGIN_ALIAS_EMAIL || ''
    const aliasPassword = import.meta.env.VITE_LOGIN_ALIAS_PASSWORD || ''
    const esAtajo = alias && `${email.trim()}:${password}` === alias && aliasEmail && aliasPassword
    const emailReal = esAtajo ? aliasEmail : email.trim()
    const passwordReal = esAtajo ? aliasPassword : password
    try { await onLogin(emailReal, passwordReal) }
    catch (err) { setError((err as Error).message || 'Error al iniciar sesión') }
    finally { setCargando(false) }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#d4d4dd] grid grid-cols-1 lg:grid-cols-2 font-sans">
      {/* === Panel branded (desktop) === */}
      <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-10 xl:p-14"
        style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0e0e15 35%, #142a1f 70%, #1a2114 100%)' }}>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#a78bfa]/8 rounded-full blur-[120px] -translate-y-1/3 translate-x-1/4" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-[#a3e635]/10 rounded-full blur-[110px] translate-y-1/3 -translate-x-1/4" aria-hidden="true" />

        {/* Top - Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURACION.pantalla, ease: EASE }}
          className="relative flex items-center gap-3"
        >
          <Marca tamano="md" />
        </motion.div>

        {/* Middle - tagline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: DURACION.pantalla, ease: EASE }}
          className="relative max-w-md"
        >
          <h1 className="font-display text-[36px] xl:text-[48px] font-bold tracking-tight leading-[1.05] text-[#ececf1]">
            Del esqueje{' '}
            <span className="text-[#d9f99d]">al recibo</span>{' '}
            firmado
          </h1>
          <p className="mt-5 text-[#a6a6b5] text-[15px] leading-relaxed">
            Registrá lo que pasa en la sala, seguí lo que cuesta producirlo y llevá
            los papeles que la asociación tiene que presentar.
          </p>
        </motion.div>

        {/* Bottom - features */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.12, duration: DURACION.pantalla }}
          className="relative space-y-3 border-t border-[#1f1f2b] pt-6"
        >
          {FEATURES.map(f => (
            <div key={f.texto} className="flex items-center gap-3">
              <f.icono className="w-4 h-4 flex-shrink-0" style={{ color: f.color }} strokeWidth={1.8} />
              <span className="text-[12px] text-[#a6a6b5]">{f.texto}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* === Panel form === */}
      <div className="relative flex items-center justify-center p-4 sm:p-6 lg:p-8 min-h-screen overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #101016 100%)' }}>
        <div className="lg:hidden absolute top-0 inset-x-0 h-44 sm:h-52 -z-0 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0e0e15 50%, #142a1f 100%)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#a78bfa]/12 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#a3e635]/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/3" aria-hidden="true" />
        </div>

        <div className="hidden lg:block absolute top-0 right-0 w-72 h-72 bg-[#a3e635]/4 rounded-full blur-[100px] -translate-y-1/3 translate-x-1/3" aria-hidden="true" />

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURACION.entrada, ease: EASE }}
          className="relative w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-5 pt-3">
            <Marca tamano="lg" centrado />
          </div>

          {/*
            EL ENLACE VENCIDO SE AVISA ACA, QUE ES DONDE LA PERSONA CAE.
            Sin esto escribe una contraseña que su cuenta todavía no tiene y no
            pasa nada: ni error ni pista. Le dice además QUE HACER, porque pedir
            otra invitación es lo único que puede hacer por su cuenta.
          */}
          {(ENLACE_VENCIDO || ENLACE_FALLIDO) && (
            <div
              role="alert"
              className="mb-4 rounded-xl bg-[#2a1f14] border border-[#5c4420] px-4 py-3 flex gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-[#f0b775] shrink-0 mt-0.5" strokeWidth={1.8} />
              <div className="text-[12px] leading-relaxed">
                {ENLACE_VENCIDO ? (
                  <>
                    <p className="text-[#ececf1] font-medium">Ese enlace ya venció</p>
                    <p className="mt-1 text-[#c9bda8]">
                      Los enlaces de invitación duran poco y se usan una sola vez. Tu cuenta
                      todavía no tiene contraseña, así que desde acá no vas a poder entrar:
                      pedile a quien te invitó que te mande uno nuevo y abrilo apenas te llegue.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[#ececf1] font-medium">No se pudo usar ese enlace</p>
                    <p className="mt-1 text-[#c9bda8]">
                      {MOTIVO_DEL_ERROR || 'El enlace no era válido.'} Pedile a quien te invitó
                      que te mande uno nuevo.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Card form */}
          <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-[#1f1f2b]">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">Bienvenido de vuelta</p>
              <h2 className="font-display font-bold tracking-tight text-[18px] sm:text-[19px] text-[#ececf1] mt-1 leading-tight">Iniciar sesión</h2>
            </div>

            <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1.5">Usuario</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8a8a9c] pointer-events-none" strokeWidth={1.8} />
                  <input
                    id="email" type="text" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin"
                    className="w-full pl-9 pr-3 py-2.5 sm:py-2 bg-[#0a0a0f] border border-[#1f1f2b] hover:border-[#2a2a3a] focus:border-[#404d20] rounded-md text-[16px] sm:text-[12px] text-[#ececf1] placeholder:text-[#8a8a9c] focus:outline-none focus:ring-1 focus:ring-[#a3e635]/40 transition-colors"
                    required autoComplete="email" autoFocus
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8a8a9c] pointer-events-none" strokeWidth={1.8} />
                  <input
                    id="password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-12 sm:pr-10 py-2.5 sm:py-2 bg-[#0a0a0f] border border-[#1f1f2b] hover:border-[#2a2a3a] focus:border-[#404d20] rounded-md text-[16px] sm:text-[12px] text-[#ececf1] placeholder:text-[#8a8a9c] focus:outline-none focus:ring-1 focus:ring-[#a3e635]/40 transition-colors"
                    required autoComplete="current-password"
                  />
                  <button
                    type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 sm:right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-[#8a8a9c] hover:text-[#a6a6b5] p-1.5 rounded transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="px-3 py-2 rounded-md bg-[#7a2820]/15 border border-[#7a2820]/50 text-[11px] text-[#ff8a7a]"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit" disabled={cargando || !email || !password}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-md border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 active:bg-[#a3e635]/15 transition-colors text-[12px] font-medium text-[#d9f99d] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn className="w-3.5 h-3.5" strokeWidth={1.8} />
                {cargando ? 'Ingresando…' : 'Ingresar'}
              </button>
            </form>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1f1f2b] text-[10px] text-[#8a8a9c] text-center font-mono tabular-nums">
            GrowFlow · trazabilidad de cultivo
          </div>
        </motion.div>
      </div>
    </div>
  )
}
