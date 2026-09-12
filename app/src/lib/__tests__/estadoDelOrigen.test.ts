import { describe, it, expect } from 'vitest'
import { estadoDelOrigen, leyendaDelOrigen, ORIGEN_EXIGIBLE_DESDE } from '../estadoDelOrigen'

// La cosecha que respalda a cada lote propio, con fecha de corte.
//
// Los 30 lotes la organización por 4.837 g van hasta el 21/08/2026 y los 2 que sí
// están trazados son del 27/08: el corte deja en falta cero y con constancia
// treinta, que es exactamente lo que se buscaba — y si mañana entra uno propio
// sin cosecha, salta.
describe('estadoDelOrigen', () => {
  const lote = (o: Partial<Parameters<typeof estadoDelOrigen>[0]> = {}) =>
    ({ origen: 'propio_sin_cosecha', fecha_elaboracion: '2026-08-21', ...o })

  it('al material comprado no se le pide cosecha', () => {
    expect(estadoDelOrigen(lote({ origen: 'comprado' }))).toBe('trazado')
  })

  it('el propio con su cosecha registrada está trazado', () => {
    expect(estadoDelOrigen(lote({ origen: 'propio' }))).toBe('trazado')
  })

  it('el propio sin cosecha anterior al corte lleva constancia', () => {
    expect(estadoDelOrigen(lote({ fecha_elaboracion: '2026-08-22' }))).toBe('anterior_al_requisito')
  })

  it('el propio sin cosecha del día del corte ya está en falta', () => {
    expect(estadoDelOrigen(lote({ fecha_elaboracion: ORIGEN_EXIGIBLE_DESDE }))).toBe('falta')
  })

  it('el propio sin cosecha posterior al corte está en falta', () => {
    expect(estadoDelOrigen(lote({ fecha_elaboracion: '2026-08-27' }))).toBe('falta')
  })

  // Si no, cualquier lote cargado hoy al que le falte la fecha se lleva la
  // excusa gratis. Misma regla que en `estadoDelAnalisis`.
  it('sin fecha NO se da por anterior', () => {
    expect(estadoDelOrigen(lote({ fecha_elaboracion: null }))).toBe('falta')
    expect(estadoDelOrigen(lote({ fecha_elaboracion: '' }))).toBe('falta')
  })

  it('la leyenda lleva la fecha de ESE lote y no una excusa general', () => {
    expect(leyendaDelOrigen(lote({ fecha_elaboracion: '2025-08-30' }))).toContain('2025-08-30')
    expect(leyendaDelOrigen(lote({ fecha_elaboracion: '2026-08-27' }))).toBeNull()
    expect(leyendaDelOrigen(lote({ origen: 'comprado' }))).toBeNull()
  })
})
