import { describe, it, expect } from 'vitest'
import {
  estadoDelLoteEntregado, leyendaDelLoteEntregado, LOTE_EXIGIBLE_DESDE,
} from '../estadoDelLoteEntregado'

// De qué lote salió cada entrega, con fecha de corte.
//
// De las 8 entregas sin lote la organización, 7 vienen de la planilla y una es del
// 24/08/2026. Que quede UNA en falta es la prueba de que el corte no es una
// amnistía: si lo fuera, no marcaría ninguna.
describe('estadoDelLoteEntregado', () => {
  it('con lote, tiene', () => {
    expect(estadoDelLoteEntregado({ fecha: '2026-08-27', lote_codigo: 'CO-01' })).toBe('tiene')
  })

  // El lote se cruza contra `ong_lotes` por texto, así que un código en blanco
  // no es un código: es no tener ninguno.
  it('un lote en blanco no cuenta como lote', () => {
    expect(estadoDelLoteEntregado({ fecha: '2026-08-27', lote_codigo: '   ' })).toBe('falta')
  })

  it('sin lote y anterior al corte lleva constancia', () => {
    expect(estadoDelLoteEntregado({ fecha: '2025-10-22', lote_codigo: null }))
      .toBe('anterior_al_requisito')
  })

  it('sin lote el día del corte ya está en falta', () => {
    expect(estadoDelLoteEntregado({ fecha: LOTE_EXIGIBLE_DESDE, lote_codigo: null })).toBe('falta')
  })

  it('sin lote y posterior al corte está en falta', () => {
    expect(estadoDelLoteEntregado({ fecha: '2026-08-24', lote_codigo: null })).toBe('falta')
  })

  // Una entrega sin fecha ya es un problema por su cuenta.
  it('sin fecha NO se da por anterior', () => {
    expect(estadoDelLoteEntregado({ fecha: null, lote_codigo: null })).toBe('falta')
  })

  it('la leyenda lleva la fecha de ESA entrega', () => {
    expect(leyendaDelLoteEntregado({ fecha: '2025-10-22', lote_codigo: null }))
      .toContain('2025-10-22')
    expect(leyendaDelLoteEntregado({ fecha: '2026-08-24', lote_codigo: null })).toBeNull()
  })
})
