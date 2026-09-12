// Quién firmó el mandato, quién no, y quién se asoció antes de que se pidiera.
//
// Al 23/08/2026 la organización tenía 209 asociados activos y CERO mandatos firmados, y
// la regla RN-03 marcaba error en cada entrega. Marcarlos como firmados habría
// sido fabricar el consentimiento de 209 personas identificadas, con fecha y
// hora, que es justo lo que le da apariencia de prueba.
//
// La salida es la que propuso Gastón: dejar constancia de que cuando esa gente
// se asoció, el mandato NO era requisito — se empezó a pedir después. No se
// inventa nada, y encima es verificable: la fecha de alta lo dice.
//
// Y sirve para algo que «marcarlos como firmados» no podía: separa al que se
// asoció antes del requisito, del que se saltó el paso teniéndolo disponible.
// El primero hay que regularizarlo; el segundo es un error de carga de ahora.

import { describe, it, expect } from 'vitest'
import { estadoDelMandato, MANDATO_EXIGIBLE_DESDE } from '../estadoDelMandato'

describe('estadoDelMandato', () => {
  it('firmado es firmado, sin importar cuándo se asoció', () => {
    expect(estadoDelMandato({ mandato_aceptado: true, fecha_alta: '2025-01-01' }))
      .toBe('firmado')
  })

  it('quien se asoció ANTES de que se pidiera no está en falta', () => {
    // Es el caso de los 209 la organización: se asociaron cuando el mandato no se
    // pedía. No firmaron, y no por saltearse nada.
    expect(estadoDelMandato({ mandato_aceptado: false, fecha_alta: '2025-08-06' }))
      .toBe('anterior_al_requisito')
  })

  it('quien se asoció DESPUÉS y no firmó, sí está en falta', () => {
    // Acá el mandato ya se pedía en el alta: si falta, es un paso salteado.
    expect(estadoDelMandato({ mandato_aceptado: false, fecha_alta: '2026-12-01' }))
      .toBe('falta')
  })

  it('el mismo día que empezó a pedirse ya cuenta como exigible', () => {
    expect(estadoDelMandato({ mandato_aceptado: false, fecha_alta: MANDATO_EXIGIBLE_DESDE }))
      .toBe('falta')
  })

  it('sin fecha de alta no se lo da por anterior', () => {
    // Dar por anterior a quien no tiene fecha sería regalar la excusa a
    // cualquier ficha incompleta, incluida una cargada hoy.
    expect(estadoDelMandato({ mandato_aceptado: false, fecha_alta: null }))
      .toBe('falta')
  })

  it('null y undefined en el mandato cuentan como no firmado', () => {
    expect(estadoDelMandato({ mandato_aceptado: null, fecha_alta: '2026-12-01' })).toBe('falta')
    expect(estadoDelMandato({ fecha_alta: '2026-12-01' })).toBe('falta')
  })

  it('la fecha desde la que se pide es una sola y está declarada', () => {
    // Si esto cambia, cambia quién queda amparado por la leyenda: tiene que ser
    // una decisión explícita y no un número perdido en una comparación.
    expect(MANDATO_EXIGIBLE_DESDE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
