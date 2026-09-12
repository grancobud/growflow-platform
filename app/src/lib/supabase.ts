import { createClient } from '@supabase/supabase-js'
import { crearClienteDemo } from './demo/demoClient'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Modo DEMO: si no hay credenciales reales de Supabase (o son los placeholders),
// usamos un cliente local respaldado por localStorage. Permite usar la app sin
// backend ni login. Apenas se configuren VITE_SUPABASE_URL/ANON_KEY validas,
// se usa el cliente real automaticamente.
function esPlaceholder(v: string | undefined): boolean {
  return !v || v.includes('tu-proyecto') || v.includes('tu-anon') || v === 'tu-anon-key'
}

export const MODO_DEMO = esPlaceholder(supabaseUrl) || esPlaceholder(supabaseAnonKey)

export const supabase = MODO_DEMO
  ? (crearClienteDemo() as unknown as ReturnType<typeof createClient>)
  : createClient(supabaseUrl as string, supabaseAnonKey as string)

if (MODO_DEMO && typeof console !== 'undefined') {
  console.info('[GrowFlow] Modo DEMO activo: datos locales en localStorage, sin backend ni login.')
}
