// El Legajo de Admisión: que las listas cerradas no se desalineen y que los
// textos firmados no cambien sin que cambie la versión.
//
// Los casos NO son inventados: son los que la planilla de la asociación ya tuvo.

import { describe, it, expect } from 'vitest'
import {
  DIAGNOSTICOS, FORMATOS, UNIDADES, VINCULACION, CONSENTIMIENTOS,
  COMPROMISO_REGULARIZAR, VERSION_CONSENTIMIENTOS,
} from '../legajo'
import { numeroDeReprocann } from '../datosDelFormulario'

describe('las listas cerradas', () => {
  it('los ocho diagnósticos del formulario, sin repetidos', () => {
    expect(DIAGNOSTICOS).toHaveLength(8)
    expect(new Set(DIAGNOSTICOS).size).toBe(8)
  })

  it('«Otro diagnóstico» existe: sin él, alguien tiene que mentir', () => {
    expect(DIAGNOSTICOS).toContain('Otro diagnóstico')
  })

  it('las unidades son las tres que la base acepta', () => {
    // El check de ong_solicitudes es (g|ml|u). Si acá aparece una cuarta, el
    // insert la descarta en silencio y la cantidad queda sin unidad.
    expect(UNIDADES.map(u => u.valor).sort()).toEqual(['g', 'ml', 'u'])
  })

  it('la vinculación tiene las tres respuestas que la base acepta', () => {
    expect(VINCULACION.map(v => v.valor).sort()).toEqual(['no', 'no_se', 'si'])
  })

  it('«no sé» es una opción: es la respuesta honesta de mucha gente', () => {
    expect(VINCULACION.map(v => v.valor)).toContain('no_se')
  })

  it('los formatos son los tres del formulario', () => {
    expect(FORMATOS).toEqual(['Flores', 'Aceites', 'Cremas'])
  })
})

describe('los consentimientos', () => {
  it('son cuatro y cada uno escribe en un campo distinto', () => {
    expect(CONSENTIMIENTOS).toHaveLength(4)
    expect(new Set(CONSENTIMIENTOS.map(c => c.campo)).size).toBe(4)
  })

  it('los campos son exactamente los que existen en la base', () => {
    expect(CONSENTIMIENTOS.map(c => c.campo).sort()).toEqual([
      'consent_jurisdiccion', 'consent_responsabilidad',
      'consent_uso_personal', 'consent_veracidad',
    ])
  })

  // Es el que sostiene que la entrega no es una compraventa. Si este texto se
  // afloja, cada dispensa queda sin el respaldo que la explica.
  it('el de responsabilidad dice que el aporte NO es una transacción comercial', () => {
    const c = CONSENTIMIENTOS.find(x => x.campo === 'consent_responsabilidad')!
    expect(c.texto).toMatch(/no constituyen una transacci[oó]n comercial/i)
    expect(c.texto).toMatch(/sostenimiento de la estructura de cultivo/i)
  })

  it('el de uso personal nombra la 23.737: sin eso no se entiende qué se firma', () => {
    const c = CONSENTIMIENTOS.find(x => x.campo === 'consent_uso_personal')!
    expect(c.texto).toMatch(/23\.737/)
    expect(c.texto).toMatch(/prohibida la venta, cesi[oó]n, donaci[oó]n o distribuci[oó]n/i)
  })

  it('el compromiso de regularizar habla del plazo de 30 días', () => {
    expect(COMPROMISO_REGULARIZAR).toMatch(/30 d[ií]as/)
  })

  // Si el texto cambia y la versión no, dos textos distintos quedan guardados
  // con el mismo nombre y ya no se sabe qué aceptó cada persona.
  it('hay una versión declarada', () => {
    expect(VERSION_CONSENTIMIENTOS).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('lo que el formulario viejo dejaba pasar', () => {
  // Ocho fichas la organización quedaron con este texto DENTRO del campo del número, y
  // eso las dejó «En tramite»: el estado con el que se puede dispensar sin que
  // la entrega quede marcada como sin respaldo.
  it('la respuesta de un desplegable no es un número de REPROCANN', () => {
    expect(numeroDeReprocann('NO TENGO, QUIERO RECIBIR INFO AL RESPECTO')).toBeNull()
    expect(numeroDeReprocann('Tengo REPROCANN VIGENTE / VENCIDO/ PENDIENTE')).toBeNull()
    expect(numeroDeReprocann('No tengo reprocann')).toBeNull()
  })

  it('un id de trámite real sí pasa', () => {
    // Los cuatro que se cargaron a mano en Chaco el 26/08/2026.
    for (const n of ['410516', '412489', '411095', '323892']) {
      expect(numeroDeReprocann(n)).toBe(n)
    }
  })

  it('y los códigos con prefijo alfanumérico también: son credenciales reales', () => {
    expect(numeroDeReprocann('a1bCde1234567')).toBe('a1bCde1234567')
  })
})
