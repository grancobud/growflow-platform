import { describe, it, expect } from 'vitest'
import { diferencia, cuadra, TOLERANCIA_GRAMOS } from '../arqueos'

// LO QUE ESTOS TESTS FIJAN NO ES ARITMÉTICA, es la diferencia entre «no falta
// nada» y «nadie contó». Un arqueo que devuelve cero cuando no se contó es peor
// que no tener arqueo: afirma que cuadra algo que nadie miró.

describe('diferencia', () => {
  it('contado menos esperado, con el signo que corresponde', () => {
    expect(diferencia(1000, 950)).toBe(-50)   // falta
    expect(diferencia(1000, 1050)).toBe(50)   // sobra
    expect(diferencia(1000, 1000)).toBe(0)
  })

  it('sin contar es null, NO cero', () => {
    // Es el caso que da sentido a la tabla. Un cero acá diría «cuadra» sobre una
    // caja que nadie abrió, y el arqueo existe justamente para que eso no pase.
    expect(diferencia(1000, null)).toBeNull()
  })

  it('sin esperado también es null: no hay contra qué comparar', () => {
    expect(diferencia(null, 950)).toBeNull()
  })

  it('redondea a dos decimales, que es lo que la base guarda', () => {
    // Sin esto, 0.1 + 0.2 mete un 0.30000000000000004 en una columna
    // `numeric(14,2)` y la diferencia deja de ser reproducible.
    expect(diferencia(770.1, 770.4)).toBe(0.3)
  })
})

describe('cuadra', () => {
  it('en pesos se exige exacto', () => {
    expect(cuadra(0)).toBe(true)
    expect(cuadra(-1)).toBe(false)
  })

  it('en gramos hay tolerancia, y no es indulgencia', () => {
    // Una balanza de mostrador tiene su propio error. Marcar en rojo medio gramo
    // entrena a la gente a ignorar el rojo, y entonces el día que falten
    // cincuenta tampoco lo mira nadie.
    expect(cuadra(0.5, TOLERANCIA_GRAMOS)).toBe(true)
    expect(cuadra(-1, TOLERANCIA_GRAMOS)).toBe(true)
    expect(cuadra(1.5, TOLERANCIA_GRAMOS)).toBe(false)
  })

  it('lo que no se contó NUNCA cuadra', () => {
    // Ni siquiera con tolerancia: no es que la diferencia sea chica, es que no
    // hay diferencia porque no hubo cuenta.
    expect(cuadra(null)).toBe(false)
    expect(cuadra(null, TOLERANCIA_GRAMOS)).toBe(false)
  })
})
