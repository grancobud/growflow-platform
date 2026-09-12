// El rinde esperado sale de la genética, no de un número suelto.
//
// Primero se modeló como un campo único de la entidad, y estaba mal: el rinde
// es de cada variedad. La ficha de Avocado Punch Auto dice «Producción:
// +145/Planta»; otra genética rinde otra cosa. El campo ya existía —
// `geneticas.rendimiento_g`— y es TEXTO libre, justamente para poder escribir
// eso.
//
// LO QUE ESTÁ EN g/m² NO SIRVE ACÁ, y es lo más importante de este parseo: un
// banco que publica «450 g/m²» no está diciendo cuánto da una planta, y tomar
// ese número como si fuera por planta infla el rinde esperado sin que se note.
// Ante la duda, no se usa.

import { describe, it, expect } from 'vitest'
import { rindeDeUnaGenetica, rindePorPlanta } from '../rindeDeGeneticas'

describe('rindeDeUnaGenetica', () => {
  it('lee la forma en que viene la ficha la organización', () => {
    expect(rindeDeUnaGenetica('+145/Planta')).toBe(145)
  })

  it('aguanta las formas de escribirlo que usa cualquiera', () => {
    expect(rindeDeUnaGenetica('145 g/planta')).toBe(145)
    expect(rindeDeUnaGenetica('145g')).toBe(145)
    expect(rindeDeUnaGenetica('~145 gr por planta')).toBe(145)
    expect(rindeDeUnaGenetica('145')).toBe(145)
  })

  it('un rango se toma por el medio', () => {
    expect(rindeDeUnaGenetica('120-160 g/planta')).toBe(140)
    expect(rindeDeUnaGenetica('120 a 160 g')).toBe(140)
  })

  it('NO toma lo que está por metro cuadrado', () => {
    // Es el caso que rompe todo en silencio: 450 g/m² no dice cuánto da una
    // planta, y usarlo como si lo dijera infla el rinde esperado.
    expect(rindeDeUnaGenetica('450 g/m2')).toBeNull()
    expect(rindeDeUnaGenetica('450 g/m²')).toBeNull()
    expect(rindeDeUnaGenetica('400-500 gr/metro cuadrado')).toBeNull()
  })

  it('pasa los kilos a gramos', () => {
    expect(rindeDeUnaGenetica('1,2 kg por planta')).toBe(1200)
    expect(rindeDeUnaGenetica('1.5kg')).toBe(1500)
  })

  it('sin número no inventa nada', () => {
    expect(rindeDeUnaGenetica(null)).toBeNull()
    expect(rindeDeUnaGenetica('')).toBeNull()
    expect(rindeDeUnaGenetica('alto')).toBeNull()
    expect(rindeDeUnaGenetica('depende del manejo')).toBeNull()
  })

  it('descarta un número que no puede ser un rinde por planta', () => {
    expect(rindeDeUnaGenetica('0 g')).toBeNull()
    expect(rindeDeUnaGenetica('99999 g')).toBeNull()
  })
})

describe('rindePorPlanta', () => {
  const g = (id: string, rendimiento_g: string | null) => ({ id, rendimiento_g })
  const p = (genetica_id: string | null, fase = 'Floracion') => ({ genetica_id, fase })

  it('con una sola variedad, es el rinde de esa variedad', () => {
    // El caso la organización: 60 plantas, todas Avocado Punch Auto.
    expect(rindePorPlanta(
      Array.from({ length: 60 }, () => p('avocado')),
      [g('avocado', '+145/Planta')],
    )).toBe(145)
  })

  it('con varias variedades pondera por cuántas plantas hay de cada una', () => {
    // 3 de 100 y 1 de 200 dan 125 de promedio, no 150: el promedio simple
    // trataría a la variedad de una sola planta igual que a la de tres.
    expect(rindePorPlanta(
      [p('a'), p('a'), p('a'), p('b')],
      [g('a', '100 g'), g('b', '200 g')],
    )).toBe(125)
  })

  it('las plantas que no están en floración no cuentan', () => {
    expect(rindePorPlanta(
      [p('a'), p('b', 'Vegetativo')],
      [g('a', '100 g'), g('b', '900 g')],
    )).toBe(100)
  })

  it('ignora las plantas cuya genética no tiene el rinde cargado', () => {
    expect(rindePorPlanta(
      [p('a'), p('b')],
      [g('a', '100 g'), g('b', null)],
    )).toBe(100)
  })

  it('si NINGUNA tiene el rinde cargado, dice que no se sabe', () => {
    expect(rindePorPlanta([p('a'), p('b')], [g('a', null), g('b', null)])).toBeNull()
  })

  it('sin plantas en floración no se puede estimar', () => {
    expect(rindePorPlanta([], [g('a', '100 g')])).toBeNull()
  })

  it('una planta sin genética asignada no rompe', () => {
    expect(rindePorPlanta([p(null), p('a')], [g('a', '100 g')])).toBe(100)
  })
})
