// Qué entrega necesita reporte de seguimiento y cuál es anterior al requisito.
//
// El caso real: 911 entregas a pacientes, 108 personas, cero reportes. El
// circuito estaba entero pero nunca se había usado, así que RN-05 iba a
// bloquearle el portal a las 108. Se resuelve como el mandato y el análisis:
// declarando desde cuándo se exige, no rellenando los reportes que faltan.

import { describe, it, expect } from 'vitest'
import {
  estadoDelSeguimiento, constanciaDeSeguimiento, SEGUIMIENTO_EXIGIBLE_DESDE,
} from '../estadoDelSeguimiento'
import { feedbackPendiente, revisarDispensa } from '../ong'
import type { Dispensa, FeedbackClinico } from '../ong'

const disp = (o: Partial<Dispensa>): Dispensa =>
  ({ id: 'd1', fecha: '2026-08-01', gramos: 5, paciente_id: 'p1', ...o }) as Dispensa
const fb = (dispensaId: string): FeedbackClinico =>
  ({ id: 'f' + dispensaId, dispensa_id: dispensaId }) as FeedbackClinico

describe('estadoDelSeguimiento', () => {
  it('reconoce la entrega que ya tiene su reporte', () => {
    expect(estadoDelSeguimiento({ id: 'd1', fecha: '2026-09-01' }, [fb('d1')]))
      .toBe('reportado')
  })

  it('ampara la entrega anterior al requisito', () => {
    expect(estadoDelSeguimiento({ id: 'd1', fecha: '2026-08-01' }, []))
      .toBe('anterior_al_requisito')
  })

  it('la posterior sin reporte sí está en falta', () => {
    expect(estadoDelSeguimiento({ id: 'd1', fecha: '2026-09-15' }, []))
      .toBe('falta')
  })

  it('el mismo día que arranca el requisito ya cuenta', () => {
    expect(estadoDelSeguimiento({ id: 'd1', fecha: SEGUIMIENTO_EXIGIBLE_DESDE }, []))
      .toBe('falta')
  })

  it('sin fecha NO regala la constancia', () => {
    // Una entrega sin fecha ya es un problema por su cuenta. Si la ausencia de
    // fecha amparara, alcanzaría con borrar la fecha para que deje de faltar.
    expect(estadoDelSeguimiento({ id: 'd1', fecha: null }, [])).toBe('falta')
    expect(estadoDelSeguimiento({ id: 'd1', fecha: '' }, [])).toBe('falta')
  })

  it('el reporte gana sobre la fecha: si está, está', () => {
    expect(estadoDelSeguimiento({ id: 'd1', fecha: '2026-01-01' }, [fb('d1')]))
      .toBe('reportado')
  })

  it('la constancia dice la fecha y por qué no se puede reconstruir', () => {
    const t = constanciaDeSeguimiento('2026-05-10')
    expect(t).toContain('2026-05-10')
    expect(t).toContain(SEGUIMIENTO_EXIGIBLE_DESDE)
    expect(t).toContain('sólo lo sabe la persona')
  })
})

describe('feedbackPendiente con el requisito por fecha', () => {
  it('no bloquea por una entrega anterior al requisito', () => {
    // Las 911 entregas la organización caen acá: sin esto, el portal quedaba
    // inutilizable para las 108 personas.
    const d = disp({ id: 'vieja', fecha: '2026-06-01' })
    expect(feedbackPendiente([d], [], 'p1')).toBeNull()
  })

  it('sí bloquea por una entrega posterior sin reporte', () => {
    const d = disp({ id: 'nueva', fecha: '2026-09-10' })
    expect(feedbackPendiente([d], [], 'p1')?.id).toBe('nueva')
  })

  it('mira la última: una vieja no tapa a la nueva sin reportar', () => {
    const vieja = disp({ id: 'vieja', fecha: '2026-06-01' })
    const nueva = disp({ id: 'nueva', fecha: '2026-09-10' })
    expect(feedbackPendiente([vieja, nueva], [], 'p1')?.id).toBe('nueva')
  })

  it('con el reporte de la última cargado, deja pasar', () => {
    const nueva = disp({ id: 'nueva', fecha: '2026-09-10' })
    expect(feedbackPendiente([nueva], [fb('nueva')], 'p1')).toBeNull()
  })

  it('sin entregas no hay nada pendiente', () => {
    expect(feedbackPendiente([], [], 'p1')).toBeNull()
  })
})

describe('RN-05 en el mostrador: avisa, no bloquea', () => {
  // El aviso decía «cargalo antes de una nueva entrega» y la pantalla de
  // Seguimiento hablaba de entregas «bloqueadas», pero `guardar` en Dispensas
  // sólo exige gramos y fecha: la entrega se registraba igual. Una app que
  // afirma un bloqueo que no hace enseña a no creerle a ninguno de sus avisos.
  //
  // Decidido con la organización el 29/08/2026, igual que RN-01 el 20/08: el aviso queda,
  // la afirmación de bloqueo no. En el PORTAL sí bloquea de verdad —ahí nadie
  // mira— y eso no se toca; ver `evaluarBloqueos` en `portal.ts`.
  const anterior = disp({ id: 'vieja', fecha: '2026-08-25' })
  const nueva = disp({ id: 'nueva', fecha: '2026-08-28' })

  it('es alerta y no error', () => {
    const av = revisarDispensa(nueva, { dispensaSinFeedback: anterior })
    const rn05 = av.find(a => /reporte de seguimiento/.test(a.texto))
    expect(rn05?.nivel).toBe('alerta')
  })

  it('no dice que la entrega no se puede hacer', () => {
    const av = revisarDispensa(nueva, { dispensaSinFeedback: anterior })
    const rn05 = av.find(a => /reporte de seguimiento/.test(a.texto))!
    expect(rn05.texto).not.toMatch(/antes de una nueva entrega|bloquea|no puede volver a retirar/i)
    // Lo que SÍ es cierto y conviene que diga.
    expect(rn05.texto).toMatch(/portal/i)
  })

  it('sobre la misma entrega no dice nada: se está editando, no entregando de nuevo', () => {
    const av = revisarDispensa(anterior, { dispensaSinFeedback: anterior })
    expect(av.find(a => /reporte de seguimiento/.test(a.texto))).toBeUndefined()
  })
})
