// Elegir mal la clase de comprobante no da error: el documento sale igual, con
// el título equivocado, y se descubre cuando alguien lo presenta. Por eso la
// ficha de cada clase tiene que estar completa y tiene que existir para TODAS
// las que el desplegable ofrece — una clase sin ficha es un desplegable mudo
// otra vez.

import { describe, it, expect } from 'vitest'
import { TIPOS_DOCUMENTO, tipoDocumentoDe, tiposDe } from '../tiposDocumento'
import { SUBTIPOS_EMITIDO, SUBTIPOS_GASTO } from '../ong'

describe('tipos de documento', () => {
  it('toda clase del desplegable tiene su ficha, salvo «Otro»', () => {
    // «Otro» es el cajón de sastre: por definición no se puede explicar qué es.
    const faltan = [...SUBTIPOS_EMITIDO, ...SUBTIPOS_GASTO]
      .filter(c => c !== 'Otro')
      .filter(c => !tipoDocumentoDe(c))
    expect(faltan).toEqual([])
  })

  it('ninguna ficha describe una clase que el desplegable no ofrece', () => {
    const validas = new Set<string>([...SUBTIPOS_EMITIDO, ...SUBTIPOS_GASTO])
    const sobran = TIPOS_DOCUMENTO.filter(t => !validas.has(t.clase)).map(t => t.clase)
    expect(sobran).toEqual([])
  })

  it('cada ficha dice para qué sirve y cuándo se usa', () => {
    const flojas = TIPOS_DOCUMENTO
      .filter(t => t.paraQue.trim().length < 30 || t.cuando.trim().length < 15)
      .map(t => t.clase)
    expect(flojas).toEqual([])
  })

  it('cada clase está de un solo lado del circuito', () => {
    const clases = TIPOS_DOCUMENTO.map(t => t.clase)
    expect(clases.filter((c, i) => clases.indexOf(c) !== i)).toEqual([])
  })

  it('los dos lados tienen fichas: la app maneja compra y entrega', () => {
    expect(tiposDe('emitido').length).toBeGreaterThan(0)
    expect(tiposDe('gasto').length).toBeGreaterThan(0)
  })

  it('la clase que respalda una entrega es un documento emitido', () => {
    // El recibo del aporte lo emite la asociación. Si estuviera del lado de los
    // gastos, el flujo de entregar mandaría a cargar un comprobante ajeno.
    expect(tipoDocumentoDe('Comprobante de dispensa')?.tipo).toBe('emitido')
  })

  it('no explota con lo que no existe', () => {
    expect(tipoDocumentoDe('Inventado')).toBeNull()
    expect(tipoDocumentoDe(null)).toBeNull()
    expect(tipoDocumentoDe(undefined)).toBeNull()
  })
})
