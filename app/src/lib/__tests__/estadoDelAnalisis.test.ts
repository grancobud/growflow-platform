// Qué lote tiene análisis, cuál no, y cuál entró antes de que se pidiera.
//
// Al 23/08/2026 los 101 lotes la organización estaban sin análisis de laboratorio, y
// la cadena marcaba el eslabón de biomasa en rojo. Exigírselo a todos deja la
// cadena rota para siempre: un análisis no se puede hacer sobre material que ya
// se entregó y se consumió.
//
// Es el mismo caso que el mandato, y se resuelve igual: hay una fecha desde la
// cual el análisis se pide. Lo anterior lleva su constancia, con la fecha en que
// ese lote entró. Y no se inventa nada, porque esa fecha ya está en el lote.

import { describe, it, expect } from 'vitest'
import {
  estadoDelAnalisis, leyendaDelAnalisis, ANALISIS_EXIGIBLE_DESDE,
} from '../estadoDelAnalisis'

describe('estadoDelAnalisis', () => {
  it('con análisis archivado, está', () => {
    expect(estadoDelAnalisis({ analisis_path: 'ong/a.pdf', fecha_elaboracion: '2025-01-01' }))
      .toBe('tiene')
  })

  it('un lote anterior a la fecha no está en falta', () => {
    expect(estadoDelAnalisis({ analisis_path: null, fecha_elaboracion: '2025-08-06' }))
      .toBe('anterior_al_requisito')
  })

  it('un lote que entra ahora sin análisis SÍ está en falta', () => {
    expect(estadoDelAnalisis({ analisis_path: null, fecha_elaboracion: '2026-12-01' }))
      .toBe('falta')
  })

  it('sin fecha de ingreso no se lo da por anterior', () => {
    // Igual que con el mandato: sería regalarle la excusa a cualquier lote
    // cargado hoy al que le falte la fecha.
    expect(estadoDelAnalisis({ analisis_path: null, fecha_elaboracion: null })).toBe('falta')
  })

  it('la leyenda dice la fecha de ESE lote, no una general', () => {
    const l = leyendaDelAnalisis({ analisis_path: null, fecha_elaboracion: '2025-08-06' })
    expect(l).toContain('2025-08-06')
  })

  it('el que tiene análisis no lleva leyenda', () => {
    expect(leyendaDelAnalisis({ analisis_path: 'x.pdf', fecha_elaboracion: '2025-01-01' }))
      .toBeNull()
  })

  it('el que está en falta tampoco lleva leyenda: no tiene excusa', () => {
    expect(leyendaDelAnalisis({ analisis_path: null, fecha_elaboracion: '2026-12-01' }))
      .toBeNull()
  })

  it('la fecha desde la que se pide está declarada', () => {
    expect(ANALISIS_EXIGIBLE_DESDE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
