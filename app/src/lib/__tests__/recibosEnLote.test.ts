// Emitir de una vez los recibos que nunca se emitieron.
//
// Al 23/08/2026 la base tenía 1.241 entregas y CERO recibos. Se numeraron 846
// —las de modalidad Paciente con aporte— y falta el papel de cada una.
//
// Lo que se prueba acá es la parte que decide QUÉ emitir, que es la que no
// puede fallar: emitir dos veces el mismo recibo deja dos papeles oficiales con
// el mismo número, y eso en un libro numerado es peor que no tener ninguno.

import { describe, it, expect } from 'vitest'
import { recibosPendientes, fechaDelRecibo } from '../recibosEnLote'

const d = (id: string, recibo_numero: number | null, fecha = '2025-09-01') =>
  ({ id, recibo_numero, fecha }) as Parameters<typeof recibosPendientes>[0][number]

const doc = (dispensa_id: string | null, subtipo = 'Recibo de reembolso') =>
  ({ dispensa_id, subtipo }) as Parameters<typeof recibosPendientes>[1][number]

describe('recibosPendientes', () => {
  it('toma las entregas numeradas que todavía no tienen su papel', () => {
    const r = recibosPendientes([d('a', 1), d('b', 2)], [])
    expect(r.map(x => x.id)).toEqual(['a', 'b'])
  })

  it('NO vuelve a emitir uno que ya se emitió', () => {
    // Dos papeles con el mismo número es lo que rompe un libro numerado.
    const r = recibosPendientes([d('a', 1), d('b', 2)], [doc('a')])
    expect(r.map(x => x.id)).toEqual(['b'])
  })

  it('ignora la entrega sin número: el papel se numera antes, no al imprimirse', () => {
    const r = recibosPendientes([d('a', null), d('b', 2)], [])
    expect(r.map(x => x.id)).toEqual(['b'])
  })

  it('un documento de OTRA clase sobre la misma entrega no cuenta como recibo', () => {
    // Una entrega tiene además su comprobante de dispensa, que es otro papel y
    // no reemplaza al recibo del aporte.
    const r = recibosPendientes([d('a', 1)], [doc('a', 'Comprobante de dispensa')])
    expect(r.map(x => x.id)).toEqual(['a'])
  })

  it('un documento suelto, sin entrega, no tapa a nadie', () => {
    const r = recibosPendientes([d('a', 1)], [doc(null)])
    expect(r.map(x => x.id)).toEqual(['a'])
  })

  it('los emite en orden de número, que es el orden del libro', () => {
    const r = recibosPendientes([d('c', 3), d('a', 1), d('b', 2)], [])
    expect(r.map(x => x.recibo_numero)).toEqual([1, 2, 3])
  })
})

describe('fechaDelRecibo', () => {
  it('lleva la fecha de la ENTREGA, no la de hoy', () => {
    // Es un recibo retroactivo: el papel documenta un aporte que se hizo el día
    // de la entrega. Estamparle la fecha de emisión diría que la plata entró
    // hoy, y no entró hoy.
    expect(fechaDelRecibo({ fecha: '2025-09-14' })).toBe('2025-09-14')
  })

  it('si la entrega no tiene fecha, no inventa una', () => {
    expect(fechaDelRecibo({ fecha: null })).toBeNull()
  })
})
