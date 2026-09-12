// El importe en letras va en un recibo firmado, asi que se testea en serio.
//
// El riesgo no es que quede feo: es que el numero y las letras digan cosas
// distintas en un documento que alguien firma. Los casos de abajo son los que
// rompen las implementaciones ingenuas —cien/ciento, el apocope de "uno",
// el "y" que va solo de treinta para arriba, el millon en singular— mas los
// importes reales que tiene la base la organización.

import { describe, it, expect } from 'vitest'
import { pesosEnLetras, fechaEnLetras } from '../actaTexto'

describe('pesosEnLetras', () => {
  it('cuenta del cero al veintinueve sin meter el "y"', () => {
    expect(pesosEnLetras(0)).toBe('cero pesos')
    expect(pesosEnLetras(1)).toBe('un peso')
    expect(pesosEnLetras(15)).toBe('quince pesos')
    expect(pesosEnLetras(16)).toBe('dieciséis pesos')
    expect(pesosEnLetras(21)).toBe('veintiuno pesos')
    expect(pesosEnLetras(22)).toBe('veintidós pesos')
    expect(pesosEnLetras(29)).toBe('veintinueve pesos')
  })

  it('mete el "y" recien de treinta para arriba', () => {
    expect(pesosEnLetras(30)).toBe('treinta pesos')
    expect(pesosEnLetras(31)).toBe('treinta y uno pesos')
    expect(pesosEnLetras(99)).toBe('noventa y nueve pesos')
  })

  it('distingue cien de ciento', () => {
    expect(pesosEnLetras(100)).toBe('cien pesos')
    expect(pesosEnLetras(101)).toBe('ciento uno pesos')
    expect(pesosEnLetras(115)).toBe('ciento quince pesos')
    expect(pesosEnLetras(200)).toBe('doscientos pesos')
    expect(pesosEnLetras(500)).toBe('quinientos pesos')
    expect(pesosEnLetras(700)).toBe('setecientos pesos')
    expect(pesosEnLetras(900)).toBe('novecientos pesos')
    expect(pesosEnLetras(999)).toBe('novecientos noventa y nueve pesos')
  })

  it('apocopa el uno delante de mil y de millon', () => {
    expect(pesosEnLetras(1000)).toBe('mil pesos')
    expect(pesosEnLetras(21_000)).toBe('veintiún mil pesos')
    expect(pesosEnLetras(31_000)).toBe('treinta y un mil pesos')
    expect(pesosEnLetras(1_000_000)).toBe('un millón de pesos')
    expect(pesosEnLetras(21_000_000)).toBe('veintiún millones de pesos')
  })

  it('usa millon en singular y millones en plural', () => {
    expect(pesosEnLetras(1_000_000)).toContain('un millón')
    expect(pesosEnLetras(2_000_000)).toContain('dos millones')
  })

  it('escribe "de pesos" solo cuando la cifra termina justo en millon', () => {
    // Termina en millones: lleva "de".
    expect(pesosEnLetras(3_000_000)).toBe('tres millones de pesos')
    // Tiene algo despues del millon: NO lleva "de".
    expect(pesosEnLetras(3_000_500)).toBe('tres millones quinientos pesos')
    expect(pesosEnLetras(1_500_000)).toBe('un millón quinientos mil pesos')
  })

  it('escribe los centavos en quebrado, no en letras', () => {
    expect(pesosEnLetras(1500.5)).toBe('mil quinientos pesos con 50/100')
    expect(pesosEnLetras(1500.05)).toBe('mil quinientos pesos con 05/100')
    expect(pesosEnLetras(1500)).toBe('mil quinientos pesos')
  })

  it('resuelve los importes que tiene la base la organización', () => {
    // El pago a proveedor mas grande, OS98.
    expect(pesosEnLetras(6_840_000)).toBe('seis millones ochocientos cuarenta mil pesos')
    // Una dispensa tipica.
    expect(pesosEnLetras(120_000)).toBe('ciento veinte mil pesos')
    expect(pesosEnLetras(15_000)).toBe('quince mil pesos')
    // El total de aprovisionamiento, con centavos.
    expect(pesosEnLetras(57_615_999.96))
      .toBe('cincuenta y siete millones seiscientos quince mil novecientos noventa y nueve pesos con 96/100')
  })

  it('no rompe con lo que no deberia recibir', () => {
    expect(pesosEnLetras(-5000)).toBe('menos cinco mil pesos')
    expect(pesosEnLetras(NaN)).toBe('[importe]')
    // Arriba de mil millones devuelve digitos en vez de redactar mal una cifra
    // que va firmada.
    expect(pesosEnLetras(1_000_000_000)).toMatch(/^1\.000\.000\.000 pesos$/)
  })
})

describe('fechaEnLetras', () => {
  it('escribe la fecha como la lleva un acta', () => {
    expect(fechaEnLetras('2026-08-21')).toBe('21 de agosto de 2026')
    expect(fechaEnLetras('2025-01-01')).toBe('1 de enero de 2025')
    expect(fechaEnLetras('2025-12-31')).toBe('31 de diciembre de 2025')
  })

  it('devuelve lo que le dieron si no es una fecha', () => {
    expect(fechaEnLetras('')).toBe('')
    expect(fechaEnLetras('cualquier cosa')).toBe('cualquier cosa')
  })
})
