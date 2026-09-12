// Cuándo una solicitud puede darse de alta sola, y cuándo no.
//
// El circuito de aprobación ya existía entero: `ong_solicitudes` tiene estado,
// motivo, paciente_id y asociado_id. Lo único que lo disparaba era una persona
// haciendo clic. Esto reemplaza ese clic, no inventa un circuito nuevo.
//
// LO QUE NO PASA LA GUARDA NO SE RECHAZA: queda pendiente, con el motivo
// escrito, y aparece en la bandeja como aparece hoy. Rechazar solo a alguien que
// quiere sumarse es la clase de decisión que no le corresponde a un sistema.
//
// ⚠ SIN CAPTCHA, POR DECISIÓN DE GASTÓN (23/08/2026). Estas guardas frenan lo
// más obvio —sin DNI válido no entra nadie, y un duplicado tampoco— pero no
// reemplazan a un captcha: un bot que invente DNIs distintos pasa igual.

import { describe, it, expect } from 'vitest'
import {
  puedeAprobarseSola, avisosDeFichaNueva, decidirSolicitud,
  type ContextoAlta, type FichaDelPadron, fichaSospechosa , contarVinculados, esperandoAlta } from '../altaAutomatica'

const CTX: ContextoAlta = {
  padron: [],
  vinculados: 100,
  topeVinculados: 150,
  sociosQueSostieneElCultivo: null,
}

const SOL = { nombre: 'Ana Pérez', dni: '30111222', telefono: '3624111222', email: 'ana@mail.com' }

describe('puedeAprobarseSola', () => {
  it('con todo en orden, se aprueba sola', () => {
    expect(puedeAprobarseSola(SOL, CTX).aprobar).toBe(true)
  })

  // ── identidad ─────────────────────────────────────────────────────────────
  it('sin DNI no se aprueba: es lo único que identifica de forma estable', () => {
    const v = puedeAprobarseSola({ ...SOL, dni: '' }, CTX)
    expect(v.aprobar).toBe(false)
    expect(v.motivo).toMatch(/DNI/i)
  })

  it('un DNI que no parece un DNI tampoco', () => {
    expect(puedeAprobarseSola({ ...SOL, dni: '123' }, CTX).aprobar).toBe(false)
    expect(puedeAprobarseSola({ ...SOL, dni: 'no-soy-un-dni' }, CTX).aprobar).toBe(false)
  })

  it('acepta el DNI con puntos, que es como lo tipea cualquiera', () => {
    expect(puedeAprobarseSola({ ...SOL, dni: '30.111.222' }, CTX).aprobar).toBe(true)
  })

  it('sin nombre no se aprueba', () => {
    expect(puedeAprobarseSola({ ...SOL, nombre: ' ' }, CTX).aprobar).toBe(false)
  })

  // ── duplicados ────────────────────────────────────────────────────────────
  it('un DNI que ya está en el padrón no se aprueba solo', () => {
    const v = puedeAprobarseSola(SOL, { ...CTX, padron: [{ dni: '30111222' }] })
    expect(v.aprobar).toBe(false)
    expect(v.motivo).toMatch(/ya está|duplicad/i)
  })

  it('compara el DNI sin puntos, para los dos lados', () => {
    expect(puedeAprobarseSola({ ...SOL, dni: '30.111.222' },
      { ...CTX, padron: [{ dni: '30111222' }] }).aprobar).toBe(false)
    expect(puedeAprobarseSola({ ...SOL, dni: '30111222' },
      { ...CTX, padron: [{ dni: '30.111.222' }] }).aprobar).toBe(false)
  })

  it('un teléfono repetido frena el alta, pero no la rechaza', () => {
    // Puede ser la misma persona con otra ficha, o un familiar compartiendo el
    // teléfono. Las dos cosas las tiene que mirar alguien.
    const v = puedeAprobarseSola(SOL, { ...CTX, padron: [{ telefono: '3624 111 222' }] })
    expect(v.aprobar).toBe(false)
    expect(v.motivo).toMatch(/teléfono/i)
  })

  it('un email repetido, igual', () => {
    const v = puedeAprobarseSola(SOL, { ...CTX, padron: [{ email: 'ANA@mail.com' }] })
    expect(v.aprobar).toBe(false)
    expect(v.motivo).toMatch(/mail/i)
  })

  // ── el tope de la 1780 ────────────────────────────────────────────────────
  it('con el padrón en el tope no se aprueba sola', () => {
    const v = puedeAprobarseSola(SOL, { ...CTX, vinculados: 150, topeVinculados: 150 })
    expect(v.aprobar).toBe(false)
    expect(v.motivo).toMatch(/tope/i)
  })

  it('con un lugar libre, entra', () => {
    expect(puedeAprobarseSola(SOL, { ...CTX, vinculados: 149, topeVinculados: 150 }).aprobar).toBe(true)
  })

  // ── la ecuación ───────────────────────────────────────────────────────────
  it('no admite más socios de los que el cultivo puede sostener', () => {
    // Es el «socios de adorno» del planteo de Bruma: admitir gente que el cupo
    // de plantas y la biomasa no justifican rompe la cadena por el eslabón de
    // arriba, que es el que sostiene a todos los demás.
    const v = puedeAprobarseSola(SOL, { ...CTX, vinculados: 100, sociosQueSostieneElCultivo: 100 })
    expect(v.aprobar).toBe(false)
    expect(v.motivo).toMatch(/cultivo|sostiene|justific/i)
  })

  it('si el cultivo da de sobra, no estorba', () => {
    expect(puedeAprobarseSola(SOL, { ...CTX, sociosQueSostieneElCultivo: 300 }).aprobar).toBe(true)
  })

  it('cuando no se sabe qué sostiene el cultivo, esa guarda no bloquea', () => {
    // Sin el rinde por planta no se puede calcular. Bloquear por un dato que
    // falta dejaría el alta automática muerta sin decir por qué.
    expect(puedeAprobarseSola(SOL, { ...CTX, sociosQueSostieneElCultivo: null }).aprobar).toBe(true)
  })

  // ── cómo informa ──────────────────────────────────────────────────────────
  it('el motivo se escribe para que lo lea una persona, no un log', () => {
    const v = puedeAprobarseSola({ ...SOL, dni: '' }, CTX)
    expect(v.motivo!.length).toBeGreaterThan(25)
  })

  it('cuando aprueba no inventa un motivo', () => {
    expect(puedeAprobarseSola(SOL, CTX).motivo).toBeNull()
  })
})

describe('avisosDeFichaNueva', () => {
  // El caso real: el 24/08/2026 entraron 12 fichas cargadas a mano y salieron 4
  // duplicados de gente que ya estaba y 5 documentos imposibles. El alta
  // automatica ya rechazaba las dos cosas; la carga a mano no miraba nada.
  const PADRON = [
    { id: 'a', dni: '38120886', telefono: '3624883333', nombre_completo: 'Juan Solís' },
    { id: 'b', dni: null, telefono: '3624100200', nombre_completo: 'Patricio Zalazar' },
    { id: 'c', dni: '30111222', telefono: '3795100200', nombre_completo: 'Natalia Escalante' },
  ]

  it('una ficha limpia no dispara ningun aviso', () => {
    expect(avisosDeFichaNueva(
      { dni: '35693266', telefono: '3624111222', nombre_completo: 'Esteban Cardozo' },
      PADRON)).toEqual([])
  })

  it('avisa cuando el DNI ya esta en el padron', () => {
    const av = avisosDeFichaNueva(
      { dni: '38120886', telefono: '3624999999', nombre_completo: 'Juan Solís' }, PADRON)
    expect(av.some(a => a.includes('ya esta en el padron') || a.includes('ya está en el padrón'))).toBe(true)
    expect(av.some(a => a.includes('Juan Solís'))).toBe(true)
  })

  it('compara el DNI sin los puntos', () => {
    // "38.120.886" y "38120886" son el mismo documento.
    expect(avisosDeFichaNueva(
      { dni: '38.120.886', telefono: null, nombre_completo: 'Juan Solís' }, PADRON).length)
      .toBeGreaterThan(0)
  })

  it('marca un CUIL de once digitos como documento imposible', () => {
    const av = avisosDeFichaNueva(
      { dni: '27387687829', telefono: null, nombre_completo: 'Rocio Maidana' }, PADRON)
    expect(av.some(a => a.includes('11 d'))).toBe(true)
  })

  it('marca los once ceros, que pasaban por tener largo suficiente', () => {
    expect(avisosDeFichaNueva(
      { dni: '00000000000', telefono: null, nombre_completo: 'Melisa Arriaga' }, PADRON).length)
      .toBeGreaterThan(0)
  })

  it('con el mismo telefono Y el mismo nombre dice que es la misma persona', () => {
    const av = avisosDeFichaNueva(
      { dni: '0', telefono: '3624100200', nombre_completo: 'Patricio Zalazar' }, PADRON)
    expect(av.some(a => a.includes('cargada dos veces'))).toBe(true)
  })

  it('con el mismo telefono pero otro nombre solo sugiere confirmarlo', () => {
    // PAC-047 y PAC-050 comparten telefono y NO son la misma persona: apellido y
    // REPROCANN distintos. Bloquear ahi seria impedir un alta legitima.
    const av = avisosDeFichaNueva(
      { dni: '40111222', telefono: '3795100200', nombre_completo: 'Natalia Iturbe' }, PADRON)
    expect(av.some(a => a.includes('familiar'))).toBe(true)
    expect(av.some(a => a.includes('cargada dos veces'))).toBe(false)
  })

  it('editar una ficha no la marca como duplicado de si misma', () => {
    expect(avisosDeFichaNueva(
      { dni: '38120886', telefono: '3624883333', nombre_completo: 'Juan Solís' },
      PADRON, 'a')).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// decidirSolicitud — los tres caminos.
//
// Los casos de abajo NO son inventados: son los que la base ya tuvo. La campaña
// del 26/08/2026 le manda el link a los 211 socios que ya están, así que el
// camino que más se va a usar es 'actualizar', no 'alta'.

describe('decidirSolicitud', () => {
  const PADRON: FichaDelPadron[] = [
    { id: 'a', dni: '30111222', nombre_completo: 'Ana Pérez', telefono: '3624111222', activo: true },
    // El caso de los 71: asociado activo, ficha de paciente archivada.
    { id: 'b', dni: '27999888', nombre_completo: 'Bruno Díaz', telefono: '3624999888', activo: false },
    // Los dos socios que comparten teléfono y NO son la misma persona.
    { id: 'c', dni: '25000111', nombre_completo: 'Carla Ruiz', telefono: '3624555555', activo: true },
  ]
  const ctx = (extra: Partial<ContextoAlta> = {}) => ({
    ...CTX, padron: PADRON, ...extra,
  })

  it('alguien nuevo va por el camino del alta', () => {
    const d = decidirSolicitud({ nombre: 'Nuevo Socio', dni: '40222333' }, ctx())
    expect(d.via).toBe('alta')
  })

  it('quien ya está con ese DNI se actualiza, no se duplica', () => {
    const d = decidirSolicitud({ nombre: 'Ana Perez', dni: '30111222' }, ctx())
    expect(d.via).toBe('actualizar')
    if (d.via !== 'actualizar') throw new Error('via')
    expect(d.ficha.id).toBe('a')
  })

  it('el DNI con puntos es el mismo DNI', () => {
    const d = decidirSolicitud({ nombre: 'Ana Perez', dni: '30.111.222' }, ctx())
    expect(d.via).toBe('actualizar')
  })

  // Es el bug que costó las fusiones a mano de PAC-133, PAC-045 y PAC-204.
  it('una ficha ARCHIVADA también se reconoce: es la misma persona', () => {
    const d = decidirSolicitud({ nombre: 'Bruno Diaz', dni: '27999888' }, ctx())
    expect(d.via).toBe('actualizar')
    if (d.via !== 'actualizar') throw new Error('via')
    expect(d.ficha.id).toBe('b')
    expect(d.motivo).toMatch(/archivada/i)
  })

  // Enganchar es escribir sobre la ficha de una persona real.
  it('NO engancha por teléfono: puede ser un familiar', () => {
    const d = decidirSolicitud(
      { nombre: 'Pareja De Carla', dni: '41777666', telefono: '3624555555' }, ctx())
    expect(d.via).toBe('frenar')
    expect(d.motivo).toMatch(/tel[eé]fono/i)
  })

  it('sin DNI no engancha ni da de alta: frena', () => {
    const d = decidirSolicitud({ nombre: 'Sin Documento', dni: '' }, ctx())
    expect(d.via).toBe('frenar')
    expect(d.motivo).toMatch(/DNI/i)
  })

  // El tope mide si entra UNO MÁS. Quien ya está no es uno más.
  it('el tope de vinculados NO frena una actualización de legajo', () => {
    const d = decidirSolicitud({ nombre: 'Ana Perez', dni: '30111222' },
      ctx({ vinculados: 300, topeVinculados: 150 }))
    expect(d.via).toBe('actualizar')
  })

  it('pero el tope sí frena un alta nueva', () => {
    const d = decidirSolicitud({ nombre: 'Nuevo Socio', dni: '40222333' },
      ctx({ vinculados: 300, topeVinculados: 150 }))
    expect(d.via).toBe('frenar')
    expect(d.motivo).toMatch(/tope/i)
  })
})


// Las 40 fichas sin DNI, que es el caso que esto existe para atajar.
//
// Al 31/08/2026 el padron tiene 40 fichas sin DNI cargado: 28 activas, 27 con
// entregas, 536 entregas entre todas — o sea la gente que MAS retira. Como el
// enganche compara `dni === dni`, esas personas al completar el formulario no
// enganchaban con su ficha y se les creaba una nueva, con el historial colgando
// de la vieja.
describe('fichaSospechosa', () => {
  const padron = [
    { id: 'a', nombre_completo: 'María José Gómez', dni: null, telefono: '3624 55-1234', activo: true },
    { id: 'b', nombre_completo: 'Juan Pérez', dni: '30111222', telefono: null, activo: true },
    { id: 'c', nombre_completo: 'Ana Ruiz', dni: null, telefono: null, email: 'ana@ejemplo.com', activo: false },
  ]

  it('encuentra a quien esta sin DNI, por el nombre', () => {
    const r = fichaSospechosa({ nombre: 'María José Gómez', dni: '27999888' }, padron)
    expect(r?.ficha.id).toBe('a')
    expect(r?.porque).toContain('nombre')
  })

  // Normaliza MAS que `beneficiarios_grafia` a proposito: el resultado de esto
  // es mandar a revision, no afirmar que dos nombres son la misma persona.
  it('aguanta tildes, mayusculas y espacios de mas', () => {
    expect(fichaSospechosa({ nombre: 'maria jose gomez', dni: '27999888' }, padron)?.ficha.id).toBe('a')
    expect(fichaSospechosa({ nombre: '  MARIA   JOSE  GOMEZ ', dni: '27999888' }, padron)?.ficha.id).toBe('a')
  })

  it('tambien por telefono, aunque este escrito distinto', () => {
    const r = fichaSospechosa({ nombre: 'Otra Persona', dni: '27999888', telefono: '+54 9 3624 551234' }, padron)
    expect(r?.ficha.id).toBe('a')
    expect(r?.porque).toContain('teléfono')
  })

  it('y por mail, incluso contra una ficha archivada', () => {
    const r = fichaSospechosa({ nombre: 'Otra', dni: '27999888', email: ' ANA@Ejemplo.com ' }, padron)
    expect(r?.ficha.id).toBe('c')
  })

  it('a alguien realmente nuevo no lo marca', () => {
    expect(fichaSospechosa({ nombre: 'Carlos Nuevo', dni: '35123456', telefono: '11 5555-0000' }, padron)).toBeNull()
  })

  // Un nombre de dos letras coincide con cualquier cosa. El piso evita que una
  // solicitud a medio llenar frene contra media bandeja.
  it('un nombre demasiado corto no alcanza para sospechar', () => {
    expect(fichaSospechosa({ nombre: 'Ana', dni: '35123456' }, [
      { id: 'x', nombre_completo: 'Ana', dni: null, activo: true },
    ])).toBeNull()
  })
})

// El caso completo, que es lo que importa: la solicitud NO crea ficha nueva.
describe('decidirSolicitud contra una ficha sin DNI', () => {
  const ctx = {
    padron: [{ id: 'a', nombre_completo: 'María José Gómez', dni: null, activo: true }],
    vinculados: 10, topeVinculados: 150, sociosQueSostieneElCultivo: 100,
  }

  it('frena en vez de duplicar, y dice por que', () => {
    const d = decidirSolicitud({ nombre: 'María José Gómez', dni: '27999888' }, ctx)
    expect(d.via).toBe('frenar')
    expect(d.motivo).toContain('ya está en el padrón')
    expect(d.motivo).toContain('no tiene DNI cargado')
  })

  // La sospecha NO pisa al enganche por DNI: si el documento coincide, se
  // actualiza la ficha como siempre.
  it('si el DNI engancha, actualiza igual que antes', () => {
    const d = decidirSolicitud({ nombre: 'Juan Pérez', dni: '30111222' },
      { ...ctx, padron: [{ id: 'b', nombre_completo: 'Juan Pérez', dni: '30111222', activo: true }] })
    expect(d.via).toBe('actualizar')
  })

  it('y alguien nuevo de verdad sigue entrando solo', () => {
    const d = decidirSolicitud({ nombre: 'Carlos Nuevo', dni: '35123456' }, ctx)
    expect(d.via).toBe('alta')
  })
})

/**
 * SER SOCIO Y ESTAR REPRESENTADO SON COSAS DISTINTAS.
 *
 * Bug real del 09/09/2026: alguien completó `/sumate`, la solicitud quedó en
 * revisión, y al querer darle el alta el sistema la frenaba con «el padrón está
 * en el tope». la organización tenía 150 socios activos y el tope en 150 — pero CERO
 * vinculados. El tope de la 1780 es sobre las personas que la asociación
 * REPRESENTA, o sea las que entregaron su código de REPROCANN.
 */
describe('contarVinculados', () => {
  it('cuenta a los que tienen código de vinculación, NO a los socios activos', () => {
    const padron = [
      { dni: '1', activo: true, codigo_vinculacion: 'VIN-1' },
      { dni: '2', activo: true, codigo_vinculacion: null },
      { dni: '3', activo: true },
    ]
    expect(contarVinculados(padron)).toBe(1)
  })

  it('un código en blanco no vincula a nadie', () => {
    expect(contarVinculados([{ dni: '1', activo: true, codigo_vinculacion: '   ' }])).toBe(0)
  })

  it('una ficha archivada no cuenta, aunque tenga código', () => {
    expect(contarVinculados([{ dni: '1', activo: false, codigo_vinculacion: 'VIN-1' }])).toBe(0)
  })

  it('un padrón lleno de socios SIN vincular no bloquea ninguna alta', () => {
    // Es el caso exacto que rompió: 150 socios, tope 150, cero vinculados.
    const padron = Array.from({ length: 150 }, (_, i) => ({
      dni: String(90000000 + i), activo: true, codigo_vinculacion: null,
    }))
    expect(contarVinculados(padron)).toBe(0)
    const d = puedeAprobarseSola(
      { nombre: 'Luis Sebastian Ledesma', dni: '34342533' },
      { ...CTX, padron, vinculados: contarVinculados(padron), topeVinculados: 150 },
    )
    expect(d.aprobar).toBe(true)
  })

  it('con 150 VINCULADOS sí se frena, que es lo que la resolución pide', () => {
    const padron = Array.from({ length: 150 }, (_, i) => ({
      dni: String(90000000 + i), activo: true, codigo_vinculacion: `VIN-${i}`,
    }))
    const d = puedeAprobarseSola(
      { nombre: 'Uno Mas', dni: '34342533' },
      { ...CTX, padron, vinculados: contarVinculados(padron), topeVinculados: 150 },
    )
    expect(d.aprobar).toBe(false)
    expect(d.motivo).toContain('tope')
  })
})

describe('esperandoAlta', () => {
  const s = (estado: string, paciente_id: string | null = null) =>
    ({ estado, paciente_id })

  it('«verificando» NO es un callejón sin salida', () => {
    // El caso de Luis Sebastian Ledesma, 09/09/2026: completó /sumate, alguien
    // tocó «Verificando», y desde ahí el alta automática dejó de mirarla. Quedó
    // abierta en la bandeja, sin motivo y sin ficha.
    expect(esperandoAlta([s('en_revision')])).toHaveLength(1)
  })

  it('una pendiente sigue entrando, como siempre', () => {
    expect(esperandoAlta([s('pendiente')])).toHaveLength(1)
  })

  it('lo que corta es la FICHA, no el estado', () => {
    // Con paciente_id ya está resuelta: volver a procesarla duplicaría la ficha.
    expect(esperandoAlta([s('en_revision', 'pac-1')])).toEqual([])
    expect(esperandoAlta([s('pendiente', 'pac-1')])).toEqual([])
  })

  it('lo cerrado no vuelve', () => {
    expect(esperandoAlta([s('aceptada'), s('rechazada')])).toEqual([])
  })
})
