import { describe, it, expect } from 'vitest'
import {
  estadoDeLaNomina, sePuedePresentar, nominaDeUsuarios, ddjjSemestral,
  TOPES_1780, CORREO_REPROCANN_ONG, type DatosNomina,
} from '../nominaMinisterio'
import type { Paciente } from '../registro'
import type { Entidad } from '../ong'

const pac = (p: Partial<Paciente>): Paciente => ({
  id: crypto.randomUUID(), nombre_completo: 'Una Persona', activo: true,
  dni: '30123456', domicilio: 'Calle 123', codigo_vinculacion: 'VINC-1',
  ...p,
} as Paciente)

const ENTIDAD = { razon_social: 'Asoc. Civil Ñandú', cuit: '30-11111111-1', sede_domicilio: 'Av. Siempreviva 742' } as Entidad

const datos = (p: Partial<DatosNomina>): DatosNomina => ({
  // El fixture arranca COHERENTE con la ley: una persona representada admite
  // hasta 9 plantas florecidas y 6 m2. La primera version ponia 60 plantas
  // sobre un padron de 1 y el test fallaba con razon.
  entidad: ENTIDAD, padron: [pac({})],
  plantasActivas: 9, plantasEnFloracion: 9, m2Cultivados: 4.44, domicilios: 1,
  lotes: [{ codigo: 'L1', thc_pct: 18 }],
  ...p,
})

const req = (rs: ReturnType<typeof estadoDeLaNomina>, clave: string) =>
  rs.find(r => r.clave === clave)!

describe('los topes del Anexo IV', () => {
  it('son los de la resolución, no parámetros de la instalación', () => {
    // Si alguien los edita porque «no le dan los números», el sistema deja de
    // medir la ley y pasa a medir un deseo.
    expect(TOPES_1780.personasRepresentadas).toBe(150)
    expect(TOPES_1780.plantasFlorecidasPorPersona).toBe(9)
    expect(TOPES_1780.m2IndoorPorPersona).toBe(6)
    expect(TOPES_1780.m2OutdoorPorPersona).toBe(15)
    expect(TOPES_1780.domiciliosDeCultivo).toBe(3)
  })

  it('el correo es el que fija la resolución', () => {
    expect(CORREO_REPROCANN_ONG).toBe('reprocannong@msal.gov.ar')
  })
})

describe('el tope de personas representadas', () => {
  const padronDe = (n: number) => Array.from({ length: n }, (_, i) => pac({ nombre_completo: `P${i}` }))
  /** Socios SIN vincular: son del padrón pero no se representan ante el Ministerio. */
  const sinVincular = (n: number) =>
    Array.from({ length: n }, (_, i) => pac({ nombre_completo: `S${i}`, codigo_vinculacion: null }))

  it('SE MIDE SOBRE LAS VINCULADAS, no sobre el padrón', () => {
    // Es el bug que tuvo la primera versión: contaba activos y daba «151 de
    // 150» en rojo, empujando a dar de baja a una persona real para arreglar un
    // número que nunca estuvo mal. Representar es tener a alguien VINCULADO.
    const r = req(estadoDeLaNomina(datos({ padron: sinVincular(151) })), 'tope_personas')
    expect(r.estado).toBe('ok')
    expect(r.valor).toBe('0 de 150')
  })

  it('151 vinculadas sí es un error', () => {
    const r = req(estadoDeLaNomina(datos({ padron: padronDe(151) })), 'tope_personas')
    expect(r.estado).toBe('error')
    expect(r.valor).toBe('151 de 150')
  })

  it('exactamente 150 vinculadas avisa, porque la próxima la deja afuera', () => {
    expect(req(estadoDeLaNomina(datos({ padron: padronDe(150) })), 'tope_personas').estado).toBe('alerta')
  })

  it('149 está bien y dice cuántos lugares quedan', () => {
    const r = req(estadoDeLaNomina(datos({ padron: padronDe(149) })), 'tope_personas')
    expect(r.estado).toBe('ok')
    expect(r.detalle).toContain('1 lugar')
  })

  it('las fichas archivadas NO cuentan para el tope', () => {
    const padron = [...padronDe(150), pac({ activo: false })]
    expect(req(estadoDeLaNomina(datos({ padron })), 'tope_personas').valor).toBe('150 de 150')
  })

  it('un padrón más grande que el tope avisa, pero NO es infracción', () => {
    // Ser socio y estar representado son cosas distintas: con 151 socios sin
    // vincular la asociación está en regla, sólo que no van a entrar todos.
    const rs = estadoDeLaNomina(datos({ padron: sinVincular(151) }))
    const aviso = rs.find(r => r.clave === 'padron_mayor_al_tope')!
    expect(aviso.estado).toBe('alerta')
    expect(aviso.valor).toBe('151 socios, 150 representables')
    expect(sePuedePresentar(rs)).toBe(false)  // sigue faltando el código, pero no por el tope
  })

  it('con el padrón dentro del tope, ese aviso no aparece', () => {
    const rs = estadoDeLaNomina(datos({ padron: sinVincular(150) }))
    expect(rs.find(r => r.clave === 'padron_mayor_al_tope')).toBeUndefined()
  })
})

describe('los campos que la nómina exige por persona', () => {
  it('sin DNI es error y NOMBRA a quién le falta', () => {
    // Un cruce que sólo dice «faltan datos» manda a buscar a ciegas sobre 151
    // fichas, y uno que hace eso se aprende a ignorar.
    const r = req(estadoDeLaNomina(datos({ padron: [pac({ nombre_completo: 'Sin Documento', dni: null })] })), 'nomina_dni')
    expect(r.estado).toBe('error')
    expect(r.quienes).toContain('Sin Documento')
  })

  it('un DNI en blanco cuenta como faltante, no como cargado', () => {
    expect(req(estadoDeLaNomina(datos({ padron: [pac({ dni: '   ' })] })), 'nomina_dni').estado).toBe('error')
  })

  it('domicilio y código de vinculación se miden por separado', () => {
    const rs = estadoDeLaNomina(datos({ padron: [pac({ domicilio: null })] }))
    expect(req(rs, 'nomina_domicilio').estado).toBe('error')
    expect(req(rs, 'nomina_vinculacion').estado).toBe('ok')
  })
})

describe('los topes de cultivo se mueven con el padrón', () => {
  it('el techo de plantas es 9 por persona representada', () => {
    const padron = Array.from({ length: 10 }, () => pac({}))
    const r = req(estadoDeLaNomina(datos({ padron, plantasEnFloracion: 90 })), 'tope_plantas')
    expect(r.valor).toBe('90 de 90')
    expect(r.estado).toBe('ok')
  })

  it('una planta de más ya es error', () => {
    const padron = Array.from({ length: 10 }, () => pac({}))
    expect(req(estadoDeLaNomina(datos({ padron, plantasEnFloracion: 91 })), 'tope_plantas').estado).toBe('error')
  })

  it('el techo de superficie es 6 m2 por persona', () => {
    const padron = Array.from({ length: 10 }, () => pac({}))
    expect(req(estadoDeLaNomina(datos({ padron, m2Cultivados: 61 })), 'tope_superficie').estado).toBe('error')
  })

  it('sin superficie cargada el requisito NO se dibuja', () => {
    // Un tope que no se puede calcular es peor que ninguno: parece que está
    // controlado. Mismo criterio que el cuarto tope del cupo.
    const rs = estadoDeLaNomina(datos({ m2Cultivados: null }))
    expect(rs.find(r => r.clave === 'tope_superficie')).toBeUndefined()
  })

  it('el cuarto domicilio está prohibido por el artículo 14', () => {
    expect(req(estadoDeLaNomina(datos({ domicilios: 4 })), 'tope_domicilios').estado).toBe('error')
    expect(req(estadoDeLaNomina(datos({ domicilios: 3 })), 'tope_domicilios').estado).toBe('ok')
  })
})

describe('la cromatografía', () => {
  it('es ALERTA y no error: la emite un laboratorio, no se arregla cargando un campo', () => {
    const r = req(estadoDeLaNomina(datos({ lotes: [{ codigo: 'L1' }, { codigo: 'L2' }] })), 'cromatografia')
    expect(r.estado).toBe('alerta')
    expect(r.valor).toBe('2 de 2 sin análisis')
  })

  it('un lote con el archivo adjunto cuenta aunque no tenga el THC cargado', () => {
    const r = req(estadoDeLaNomina(datos({ lotes: [{ codigo: 'L1', analisis_path: 'x.pdf' }] })), 'cromatografia')
    expect(r.estado).toBe('ok')
  })
})

describe('sePuedePresentar', () => {
  it('con todo en orden, sí', () => {
    expect(sePuedePresentar(estadoDeLaNomina(datos({})))).toBe(true)
  })

  it('una alerta NO frena la presentación; un error sí', () => {
    // La cromatografía pendiente no puede bloquear una nómina: si lo hiciera,
    // la asociación no podría presentar nunca hasta tener el laboratorio.
    expect(sePuedePresentar(estadoDeLaNomina(datos({ lotes: [{ codigo: 'L1' }] })))).toBe(true)
    expect(sePuedePresentar(estadoDeLaNomina(datos({ padron: [pac({ dni: null })] })))).toBe(false)
  })
})

describe('la nómina como documento', () => {
  it('numera y pone los cuatro campos en el orden de la resolución', () => {
    const d = nominaDeUsuarios([pac({ nombre_completo: 'Ana Gómez', dni: '30111222', domicilio: 'Belgrano 100', codigo_vinculacion: 'V-9' })], ENTIDAD, '2026-09-08')
    expect(d.texto).toContain('1. Ana Gómez  |  DNI 30111222  |  Belgrano 100  |  Vinc. V-9')
    expect(d.faltantes).toEqual([])
  })

  it('INCLUYE los renglones incompletos, marcados', () => {
    // Sacarlos daría una nómina prolija y más corta que el padrón real, y esa
    // diferencia es exactamente lo que una inspección pregunta.
    const d = nominaDeUsuarios([pac({ nombre_completo: 'Sin Doc', dni: null })], ENTIDAD, '2026-09-08')
    expect(d.texto).toContain('Sin Doc')
    expect(d.texto).toContain('— falta DNI —')
    expect(d.faltantes).toContain('el DNI de 1 persona')
  })

  it('no lista a los archivados', () => {
    const d = nominaDeUsuarios([pac({ nombre_completo: 'Activa' }), pac({ nombre_completo: 'Archivada', activo: false })], ENTIDAD, '2026-09-08')
    expect(d.texto).toContain('Activa')
    expect(d.texto).not.toContain('Archivada')
  })

  it('avisa cuando el padrón supera el tope', () => {
    const padron = Array.from({ length: 151 }, (_, i) => pac({ nombre_completo: `P${i}` }))
    expect(nominaDeUsuarios(padron, ENTIDAD, '2026-09-08').faltantes)
      .toContain('bajar el padrón a 150: hay 151')
  })

  it('sin CUIT, la línea del CUIT se OMITE en vez de inventarse', () => {
    const d = nominaDeUsuarios([pac({})], { razon_social: 'X' } as Entidad, '2026-09-08')
    expect(d.texto).not.toContain('CUIT')
    expect(d.faltantes).toContain('el CUIT')
  })

  it('deja escrita la conformidad y la renuncia a autocultivar', () => {
    // Es un requisito de la resolución que no vive en ninguna columna: si el
    // papel no lo dice, no está declarado en ningún lado.
    const d = nominaDeUsuarios([pac({})], ENTIDAD, '2026-09-08')
    expect(d.texto).toContain('renunció a inscribirse como autocultivador')
  })
})

describe('la DDJJ semestral', () => {
  it('lleva los cuatro números que pide la resolución', () => {
    const d = ddjjSemestral(datos({}), '2026-09-08', ['Avocado Punch Auto'])
    expect(d.texto).toContain('Cantidad total de plantas: 9')
    expect(d.texto).toContain('Cantidad de plantas en floración: 9')
    expect(d.texto).toContain('Cantidad de pacientes vinculados: 1')
    expect(d.texto).toContain('Avocado Punch Auto')
    expect(d.faltantes).toEqual([])
  })

  it('cuenta VINCULADOS, no activos: no es lo mismo', () => {
    const d = ddjjSemestral(datos({ padron: [pac({}), pac({ codigo_vinculacion: null })] }), '2026-09-08', ['G'])
    expect(d.texto).toContain('Cantidad de pacientes vinculados: 1')
    expect(d.texto).toContain('Personas representadas en el padrón: 2')
  })

  it('sin genética cargada lo reclama en vez de dejar la línea vacía', () => {
    const d = ddjjSemestral(datos({}), '2026-09-08', [])
    expect(d.faltantes).toContain('la variedad genética registrada')
    expect(d.texto).not.toContain('Variedad genética')
  })
})
