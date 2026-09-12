// El circuito público de alta.
//
// Es el único lugar del sistema donde escribe alguien sin cuenta, sobre una
// base con pacientes reales y datos de salud. Lo que se prueba acá es lo que
// tiene que seguir siendo cierto aunque alguien toque el código sin acordarse
// de por qué estaba así.
//
// La seguridad de verdad vive en la base —`anon` no tiene ni un permiso sobre
// `ong_solicitudes`, y las dos funciones son toda la superficie pública— y eso
// se verificó atacando la API con la clave anónima real. Estos tests cubren la
// otra mitad: que la app no vuelva a exponer por su cuenta lo que la base
// protege, y que las reglas del modo demo digan lo mismo que el SQL.

import { describe, it, expect, beforeEach } from 'vitest'
import { queSigue, etiquetaEstado, colorEstado, type EstadoPublico } from '../solicitudes'

const base: EstadoPublico = {
  estado: 'pendiente',
  nombre: 'Ana Torres',
  creada_en: '2026-08-22T10:00:00Z',
  actualizada_en: '2026-08-22T10:00:00Z',
  motivo: null,
  entidad: 'Asociación Civil Ñandú',
  codigo_vinculacion: 'AC-1234',
  reprocann_cargado: false,
  reprocann_nro: null,
}

describe('qué le toca hacer a la persona', () => {
  it('mientras se revisa, el turno es SUYO: vincular el REPROCANN', () => {
    // Es la razón de ser de la pantalla. «Pendiente» a secas no dice si hay que
    // esperar o hacer algo, y esa diferencia es todo el problema: la persona
    // esperaba a que la llamaran mientras el trámite la esperaba a ella.
    for (const estado of ['pendiente', 'en_revision'] as const) {
      const r = queSigue({ ...base, estado })
      expect(r.tuTurno).toBe(true)
      expect(r.titulo).toMatch(/REPROCANN/i)
    }
  })

  it('no le manda a pedir un código: el código lo saca ella', () => {
    // Hasta el 02/09/2026 esta pantalla decia «pedile el código de vinculación
    // a la asociación», y era al reves. Peor: contradecia al paso 1 de
    // `/sumate`, que ya lo contaba bien. El texto ya no depende de que la
    // entidad tenga un codigo cargado, porque ese codigo no existe.
    const con = queSigue(base)
    const sin = queSigue({ ...base, codigo_vinculacion: null })
    expect(con.detalle).toEqual(sin.detalle)
    expect(sin.detalle).not.toMatch(/pedile/i)
    expect(sin.detalle).toMatch(/TU código de vinculación/)
  })

  it('aceptada y rechazada no son turno de la persona', () => {
    expect(queSigue({ ...base, estado: 'aceptada' }).tuTurno).toBe(false)
    expect(queSigue({ ...base, estado: 'rechazada' }).tuTurno).toBe(false)
  })

  it('el rechazo muestra el motivo que le escribieron', () => {
    const r = queSigue({ ...base, estado: 'rechazada', motivo: 'El DNI no coincide' })
    expect(r.detalle).toBe('El DNI no coincide')
  })

  it('un rechazo sin motivo no deja la pantalla muda', () => {
    const r = queSigue({ ...base, estado: 'rechazada', motivo: null })
    expect(r.detalle.trim().length).toBeGreaterThan(10)
  })
})

describe('etiquetas de estado', () => {
  it('ningún estado se muestra con su nombre interno', () => {
    // `en_revision` en pantalla es de las cosas que hacen que un sistema
    // parezca hecho a medias.
    for (const e of ['pendiente', 'en_revision', 'aceptada', 'rechazada']) {
      expect(etiquetaEstado(e)).not.toBe(e)
      expect(colorEstado(e)).toMatch(/^#/)
    }
  })

  it('un estado desconocido no rompe la pantalla', () => {
    // Si mañana la base suma un estado y el front no se entera, la fila tiene
    // que dibujarse igual. Es el mismo error que ya costó una pestaña caída.
    expect(etiquetaEstado('en_pausa')).toBe('en_pausa')
    expect(colorEstado('en_pausa')).toMatch(/^#/)
  })
})

describe('lo que la pantalla pública devuelve', () => {
  // El cliente demo imita las dos funciones de la base para que /sumate ande
  // sin backend. Si esa copia se desvía del SQL, la demo enseña algo que la
  // instalación real no hace.
  let rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>

  // Los tests corren en node, sin navegador. En vez de sumar jsdom entero —una
  // dependencia grande para usar cuatro métodos— alcanza con un localStorage de
  // memoria: es todo lo que el cliente demo toca.
  beforeEach(async () => {
    const datos = new Map<string, string>()
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, String(v)),
      removeItem: (k: string) => void datos.delete(k),
      clear: () => datos.clear(),
      key: (i: number) => [...datos.keys()][i] ?? null,
      get length() { return datos.size },
    } as Storage

    const { crearClienteDemo } = await import('../demo/demoClient')
    const c = crearClienteDemo() as unknown as { rpc: typeof rpc }
    rpc = c.rpc.bind(c)
  })

  it('el estado NO devuelve el DNI', async () => {
    // Lo importante del test. El link puede terminar reenviado por WhatsApp o
    // en un historial compartido: lo que se expone tiene que ser un nombre y un
    // estado, nunca un documento. La función real ya no lo selecciona; esto
    // impide que la demo lo agregue «para que se vea completo».
    const { data: token } = await rpc('solicitud_crear', {
      p_nombre: 'Ana Torres', p_dni: '30123456',
    })
    const { data } = await rpc('solicitud_estado', { p_token: token })
    const fila = (data as Record<string, unknown>[])[0]
    expect(fila).toBeDefined()
    expect(Object.keys(fila)).not.toContain('dni')
    expect(JSON.stringify(fila)).not.toContain('30123456')
  })

  it('un token que no abre nada devuelve vacío, no un error que confirme', async () => {
    // Decir «esa solicitud no existe» sería una forma de ir probando.
    const { data } = await rpc('solicitud_estado', { p_token: '0'.repeat(64) })
    expect(data).toEqual([])
  })

  it('un token de largo raro no pesca la primera fila', async () => {
    await rpc('solicitud_crear', { p_nombre: 'Ana Torres', p_dni: '30123456' })
    for (const t of ['', '0', 'null', '0'.repeat(63)]) {
      expect((await rpc('solicitud_estado', { p_token: t })).data).toEqual([])
    }
  })

  it('el token es largo: adivinarlo no es una vía de entrada', async () => {
    const { data } = await rpc('solicitud_crear', { p_nombre: 'Ana Torres', p_dni: '30123456' })
    expect(String(data)).toHaveLength(64)
  })

  it('dos solicitudes no comparten token', async () => {
    const a = await rpc('solicitud_crear', { p_nombre: 'Ana Torres', p_dni: '30123456' })
    const b = await rpc('solicitud_crear', { p_nombre: 'Beto Rivas', p_dni: '28999111' })
    expect(a.data).not.toEqual(b.data)
  })

  it('el mismo documento dos veces no entra de nuevo', async () => {
    // Contra el doble clic y contra quien reenvía el formulario porque no supo
    // si llegó. El punto: «12.345.678» y «12345678» son el MISMO documento.
    await rpc('solicitud_crear', { p_nombre: 'Ana Torres', p_dni: '30123456' })
    const otra = await rpc('solicitud_crear', { p_nombre: 'Ana T', p_dni: '30.123.456' })
    expect(otra.error).toBeTruthy()
  })

  it('no entran datos que no sirven para dar de alta a nadie', async () => {
    expect((await rpc('solicitud_crear', { p_nombre: 'ab', p_dni: '30123456' })).error).toBeTruthy()
    expect((await rpc('solicitud_crear', { p_nombre: 'Ana Torres', p_dni: '123' })).error).toBeTruthy()
    expect((await rpc('solicitud_crear', { p_nombre: 'Ana Torres', p_dni: '1234567890' })).error).toBeTruthy()
  })
})
