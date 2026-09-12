import { describe, it, expect } from 'vitest'
import {
  totalesDeStock, ordenarPorLoQueQueda, type LoteEnStock,
} from '../stockDeLotes'

// El stock que ve el cultivo.
//
// La regla que lo justifica: el cultivador tiene que saber cuánto queda de lo
// que produjo, y NO cuánto vale ni a quién se le dio. Por eso lee de la vista
// `lotes_stock`, que no tiene `costo_por_gramo` —$XX.XXX.XXX de material
// valorizado al 30/08/2026— y trae lo entregado sumado por lote.

const lote = (o: Partial<LoteEnStock> = {}): LoteEnStock => ({
  id: 'L1', codigo: 'CO-01', producto: 'Cookies',
  gramos_totales: 100, unidad: 'g', origen: 'propio', proveedor: null,
  activo: true, fecha_elaboracion: '2026-08-01',
  thc_pct: null, cbd_pct: null, analisis_path: null,
  entregado: 40, restante: 60, ...o,
})

describe('totalesDeStock', () => {
  it('suma entrado, entregado y restante', () => {
    const t = totalesDeStock([
      lote({ gramos_totales: 100, entregado: 40, restante: 60 }),
      lote({ id: 'L2', gramos_totales: 50, entregado: 50, restante: 0 }),
    ])
    expect(t.lotes).toBe(2)
    expect(t.entrado).toBe(150)
    expect(t.entregado).toBe(90)
    expect(t.restante).toBe(60)
  })

  // El aceite va en frascos y los accesorios en unidades: sumarlos daría un
  // número que mezcla 21 frascos con 2.719 g y no significa nada. Mismo criterio
  // que `balanceMateria`.
  it('sólo cuenta lo que se mide en gramos', () => {
    const t = totalesDeStock([
      lote({ gramos_totales: 100, entregado: 40, restante: 60 }),
      lote({ id: 'L2', unidad: 'u', gramos_totales: 900, entregado: 0, restante: 900 }),
    ])
    expect(t.entrado).toBe(100)
    expect(t.restante).toBe(60)
    expect(t.lotes).toBe(2)
  })

  it('sin unidad cargada se lee como gramos', () => {
    const t = totalesDeStock([lote({ unidad: null, gramos_totales: 30, restante: 30, entregado: 0 })])
    expect(t.entrado).toBe(30)
  })

  // NEGATIVO se cuenta y no se recorta: significa que se entregó más de lo que
  // el lote declara haber tenido. Llevarlo a cero escondería justo el problema.
  it('cuenta los sobregirados y no los recorta a cero', () => {
    const t = totalesDeStock([
      lote({ gramos_totales: 100, entregado: 130, restante: -30 }),
      lote({ id: 'L2', gramos_totales: 100, entregado: 10, restante: 90 }),
    ])
    expect(t.sobregirados).toBe(1)
    expect(t.restante).toBe(60)
  })

  it('sin lotes no explota', () => {
    const t = totalesDeStock([])
    expect(t).toEqual({ lotes: 0, entrado: 0, entregado: 0, restante: 0, sobregirados: 0 })
  })
})

describe('ordenarPorLoQueQueda', () => {
  // Un lote vacío ya no es stock: la pregunta de la pantalla es «qué hay en el
  // estante», así que lo que queda va primero.
  it('los que todavía tienen material van primero', () => {
    const r = ordenarPorLoQueQueda([
      lote({ id: 'vacio', restante: 0 }),
      lote({ id: 'poco', restante: 5 }),
      lote({ id: 'mucho', restante: 500 }),
    ])
    expect(r.map(l => l.id)).toEqual(['mucho', 'poco', 'vacio'])
  })

  it('un sobregirado no se cuela entre los que tienen material', () => {
    const r = ordenarPorLoQueQueda([
      lote({ id: 'negativo', restante: -30 }),
      lote({ id: 'tiene', restante: 10 }),
    ])
    expect(r[0].id).toBe('tiene')
  })

  it('no muta el arreglo que recibe', () => {
    const original = [lote({ id: 'a', restante: 0 }), lote({ id: 'b', restante: 9 })]
    ordenarPorLoQueQueda(original)
    expect(original.map(l => l.id)).toEqual(['a', 'b'])
  })
})
