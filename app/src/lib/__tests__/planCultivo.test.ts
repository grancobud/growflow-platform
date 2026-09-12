import { describe, it, expect } from 'vitest'
import { desvioDePlantas, planVigente, type PlanCultivo } from '../planCultivo'

const plan = (p: Partial<PlanCultivo>): PlanCultivo => ({
  id: 'p', nombre: 'Ciclo', desde: null, hasta: null,
  plantas_previstas: null, pacientes_previstos: null,
  geneticas: null, espacios: null, riego: null, fertilizacion: null,
  luces: null, notas: null, activo: true,
  creado_por: null, creado_en: '', actualizado_en: '', ...p,
})

// LO QUE ESTOS TESTS FIJAN es la diferencia entre «no declaró» y «declaró
// cero». El plan existe para poder decir «declaraste 60 y hay 63»; si un plan
// a medio llenar contestara «hay 63 de más», el cruce diría una barbaridad
// sobre un plan que nunca puso un tope — y se aprendería a ignorarlo.

describe('desvioDePlantas', () => {
  it('dice cuántas hay de más', () => {
    const d = desvioDePlantas(plan({ plantas_previstas: 60 }), 63)
    expect(d.diferencia).toBe(3)
  })

  it('y cuántas de menos', () => {
    expect(desvioDePlantas(plan({ plantas_previstas: 60 }), 57).diferencia).toBe(-3)
  })

  it('sin número declarado no hay desvío, aunque haya plantas', () => {
    const d = desvioDePlantas(plan({ plantas_previstas: null }), 63)
    expect(d.diferencia).toBeNull()
    expect(d.reales).toBe(63)
  })

  it('sin plan tampoco: no hay contra qué comparar', () => {
    expect(desvioDePlantas(null, 63).diferencia).toBeNull()
  })

  it('declarar cero SÍ es declarar: 63 sobre cero son 63 de más', () => {
    expect(desvioDePlantas(plan({ plantas_previstas: 0 }), 63).diferencia).toBe(63)
  })
})

describe('planVigente', () => {
  const hoy = new Date('2026-09-02')

  it('el que cubre la fecha', () => {
    const p = planVigente([
      plan({ id: 'viejo', desde: '2026-01-01', hasta: '2026-06-30' }),
      plan({ id: 'actual', desde: '2026-07-01', hasta: '2026-12-31' }),
    ], hoy)
    expect(p?.id).toBe('actual')
  })

  it('en el solapamiento del cambio de ciclo gana el que arrancó más tarde', () => {
    // Conviven el que termina y el que arranca, y no se fuerza uno solo activo
    // por eso mismo. El nuevo es el que manda.
    const p = planVigente([
      plan({ id: 'sale', desde: '2026-03-01', hasta: '2026-09-30' }),
      plan({ id: 'entra', desde: '2026-09-01', hasta: '2027-02-28' }),
    ], hoy)
    expect(p?.id).toBe('entra')
  })

  it('un plan a medio llenar sigue siendo el plan', () => {
    expect(planVigente([plan({ id: 'sinFechas' })], hoy)?.id).toBe('sinFechas')
  })

  it('los inactivos no cuentan', () => {
    expect(planVigente([plan({ activo: false })], hoy)).toBeNull()
  })

  it('los vencidos tampoco', () => {
    expect(planVigente([plan({ desde: '2026-01-01', hasta: '2026-06-30' })], hoy)).toBeNull()
  })
})
