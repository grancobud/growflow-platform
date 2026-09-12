// El módulo lee `window.location.hash` AL IMPORTARSE, así que cada caso tiene
// que fijar el hash y después importarlo fresco con `resetModules` + `import()`.
// Es la misma razón por la que existe: si se leyera en un componente, el cliente
// de Supabase ya habría limpiado el hash para cuando corriera.

import { describe, it, expect, beforeEach, vi } from 'vitest'

async function conHash(hash: string) {
  vi.resetModules()
  Object.defineProperty(globalThis, 'window', {
    value: { location: { hash } },
    writable: true, configurable: true,
  })
  return await import('../enlaceDeAcceso')
}

describe('enlaceDeAcceso', () => {
  beforeEach(() => { vi.resetModules() })

  it('reconoce la invitación', async () => {
    const m = await conHash('#access_token=abc&type=invite')
    expect(m.TIPO_DE_ENLACE).toBe('invite')
    expect(m.LLEGO_POR_ENLACE).toBe(true)
    expect(m.ENLACE_VENCIDO).toBe(false)
  })

  it('reconoce la recuperación', async () => {
    const m = await conHash('#access_token=abc&type=recovery')
    expect(m.TIPO_DE_ENLACE).toBe('recovery')
    expect(m.LLEGO_POR_ENLACE).toBe(true)
  })

  it('el enlace VENCIDO se detecta y no se confunde con una entrada normal', async () => {
    // El caso real del 10/09/2026: Supabase no manda `type` cuando expiró, manda
    // `error`. Como sólo se leía `type`, la persona caía en el login y escribía
    // una contraseña que su cuenta no tenía. Sin error y sin pista.
    const m = await conHash(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    expect(m.ENLACE_VENCIDO).toBe(true)
    expect(m.ENLACE_FALLIDO).toBe(false)
    expect(m.LLEGO_POR_ENLACE).toBe(false)
    expect(m.MOTIVO_DEL_ERROR).toBe('Email link is invalid or has expired')
  })

  it('otro error NO se anuncia como vencido', async () => {
    // Al vencido se le promete un remedio concreto —pedí otra invitación— y esa
    // promesa sólo vale para ese código. Otro error necesita decir lo suyo.
    const m = await conHash('#error=server_error&error_description=Something+went+wrong')
    expect(m.ENLACE_VENCIDO).toBe(false)
    expect(m.ENLACE_FALLIDO).toBe(true)
    expect(m.MOTIVO_DEL_ERROR).toBe('Something went wrong')
  })

  it('entrar normalmente no dispara ningún aviso', async () => {
    const m = await conHash('')
    expect(m.TIPO_DE_ENLACE).toBeNull()
    expect(m.LLEGO_POR_ENLACE).toBe(false)
    expect(m.ENLACE_VENCIDO).toBe(false)
    expect(m.ENLACE_FALLIDO).toBe(false)
  })
})
