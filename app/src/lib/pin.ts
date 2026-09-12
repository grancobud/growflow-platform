// PIN local de desbloqueo. Es una traba de conveniencia (para no tipear admin/admin
// en el invernadero), NO el mecanismo de auth real: eso lo da la sesion de Supabase.
// Usa un hash simple porque la app corre sobre http en la LAN (sin crypto.subtle).

const KEY_PIN = 'growflow-pin'
const KEY_UNLOCK = 'growflow-pin-unlocked'

function hash(pin: string): string {
  let h = 0x811c9dc5
  const s = 'gf:' + pin
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export function tienePin(): boolean {
  try { return !!localStorage.getItem(KEY_PIN) } catch { return false }
}

export function definirPin(pin: string): void {
  localStorage.setItem(KEY_PIN, hash(pin))
  sessionStorage.setItem(KEY_UNLOCK, '1')
}

export function quitarPin(): void {
  localStorage.removeItem(KEY_PIN)
  sessionStorage.removeItem(KEY_UNLOCK)
}

export function verificarPin(pin: string): boolean {
  try {
    const ok = localStorage.getItem(KEY_PIN) === hash(pin)
    if (ok) sessionStorage.setItem(KEY_UNLOCK, '1')
    return ok
  } catch { return false }
}

export function estaDesbloqueado(): boolean {
  try { return sessionStorage.getItem(KEY_UNLOCK) === '1' } catch { return true }
}

export function bloquear(): void {
  sessionStorage.removeItem(KEY_UNLOCK)
}
