// Tests del catálogo: cuánto queda de cada lote y cuánto vale el stock.
//
// Es la parte que decide si un lote se puede reservar y qué stock ve un
// paciente. Dos bugs reales vivieron acá y los dos daban un número creíble:
//
//   - contar sólo los pedidos del portal mostraba stock que ya no estaba en el
//     estante, porque en esta instalación TODO sale por mostrador
//   - sumar frascos de aceite junto con gramos de flor: 21 frascos entraban al
//     total como si fueran 21 g
//
// Ninguno de los dos rompía nada visible. Por eso van con test.

import { describe, it, expect } from 'vitest'
import {
  disponibleDeLote, resumenCatalogo, materialSinLotear,
  type Lote, type Pedido,
} from '../portal'
import type { Dispensa } from '../ong'

const lote = (o: Partial<Lote>): Lote => ({
  id: 'L1', codigo: 'A-F14726', producto: 'flor', gramos_totales: 100,
  activo: true, ...o,
} as Lote)

const pedido = (o: Partial<Pedido>): Pedido => ({
  id: Math.random().toString(36).slice(2), codigo_reserva: 'RSV-0000-2026',
  lote_id: 'L1', gramos: 0, monto_reembolso: 0,
  estado_pedido: 'Reservado', fecha_expiracion: '2099-01-01',
  ...o,
} as Pedido)

const disp = (o: Partial<Dispensa>): Dispensa =>
  ({ id: Math.random().toString(36).slice(2), fecha: '2026-08-01', gramos: 0, ...o }) as Dispensa

describe('disponibleDeLote', () => {
  it('descuenta lo que salio por mostrador, no solo los pedidos', () => {
    // El bug: sin esto el catálogo ofrecía 100 g de un lote del que ya habían
    // salido 40 por la puerta.
    const d = disponibleDeLote(lote({}), [], [
      disp({ lote_codigo: 'A-F14726', gramos: 40 }),
    ])
    expect(d.porDispensa).toBe(40)
    expect(d.disponible).toBe(60)
  })

  it('cruza la dispensa por CODIGO de lote, no por id', () => {
    // `ong_dispensas` guarda el código en texto: si se cruzara por id no
    // matchearía nunca y el descuento sería siempre 0.
    const d = disponibleDeLote(lote({ codigo: 'CO-01' }), [], [
      disp({ lote_codigo: 'OTRO', gramos: 40 }),
    ])
    expect(d.porDispensa).toBe(0)
    expect(d.disponible).toBe(100)
  })

  it('suma pedidos entregados y dispensas sin pisarse', () => {
    const d = disponibleDeLote(lote({}),
      [pedido({ estado_pedido: 'Entregado', gramos: 10 })],
      [disp({ lote_codigo: 'A-F14726', gramos: 25 })])
    expect(d.entregado).toBe(35)
    expect(d.disponible).toBe(65)
  })

  it('lo reservado aparta stock sin haberlo entregado', () => {
    const d = disponibleDeLote(lote({}), [pedido({ gramos: 30 })])
    expect(d.reservado).toBe(30)
    expect(d.entregado).toBe(0)
    expect(d.disponible).toBe(70)
  })

  it('una reserva vencida libera el stock', () => {
    // Si no, un lote entero queda bloqueado para siempre porque alguien reservó
    // y no fue a buscarlo.
    const d = disponibleDeLote(lote({}),
      [pedido({ gramos: 30, fecha_expiracion: '2020-01-01' })],
      [], new Date('2026-08-01'))
    expect(d.reservado).toBe(0)
    expect(d.disponible).toBe(100)
  })

  it('nunca da disponible negativo', () => {
    // KK-A190126 real: entraron 30 y salieron 33. Mostrar −3 en el catálogo no
    // ayuda a nadie; el sobregiro lo reporta el cruce de Coherencia.
    const d = disponibleDeLote(lote({ gramos_totales: 30 }), [],
      [disp({ lote_codigo: 'A-F14726', gramos: 33 })])
    expect(d.disponible).toBe(0)
  })

  it('el sufijo acompana la unidad del lote', () => {
    expect(disponibleDeLote(lote({ unidad: 'u' }), []).sufijo).toBe('u')
    expect(disponibleDeLote(lote({}), []).sufijo).toBe('g')
  })
})

describe('resumenCatalogo', () => {
  const lotes = [
    lote({ id: 'L1', codigo: 'A-G14726', gramos_totales: 40, unidad: 'g', costo_por_gramo: 7500 }),
    lote({ id: 'L2', codigo: 'A-F14726', gramos_totales: 70, unidad: 'g', costo_por_gramo: 7500 }),
    lote({ id: 'L3', codigo: 'R-CBD', gramos_totales: 2, unidad: 'u', costo_por_gramo: 35000 }),
    lote({ id: 'L4', codigo: 'VIEJO', gramos_totales: 100, unidad: 'g', costo_por_gramo: 8000, activo: false }),
    lote({ id: 'L5', codigo: 'SINCOSTO', gramos_totales: 10, unidad: 'g', costo_por_gramo: null }),
  ]
  const dispensas = [
    disp({ lote_codigo: 'A-F14726', gramos: 34, unidad: 'g' }),
    disp({ lote_codigo: 'R-CBD', gramos: 1, unidad: 'u' }),
  ]

  it('los totales en gramos NO incluyen los frascos', () => {
    // 21 frascos entraban al total como si fueran 21 g.
    const r = resumenCatalogo(lotes, [], dispensas)
    expect(r.otrasUnidades).toBe(1)
    expect(r.disponible).toBe(40 + (70 - 34) + 10)
  })

  it('vale en stock: los 605.000 de produccion', () => {
    // 40x7500 + 36x7500 + 1x35000 = 605.000, el número real de la base.
    // El lote inactivo no cuenta: ya no está en el estante.
    const r = resumenCatalogo(lotes, [], dispensas)
    expect(r.enStock).toBe(605000)
  })

  it('lo invertido va sobre TODOS los lotes, tambien los inactivos', () => {
    // Es lo que se gastó en mercadería desde que arrancaron, incluyendo lo ya
    // entregado. Contar sólo los activos daría casi cero.
    const r = resumenCatalogo(lotes, [], dispensas)
    expect(r.invertido).toBe(40 * 7500 + 70 * 7500 + 2 * 35000 + 100 * 8000)
  })

  it('avisa cuantos lotes no tienen costo cargado', () => {
    // Sin ese aviso los dos totales de arriba parecen completos cuando no lo son.
    expect(resumenCatalogo(lotes, [], dispensas).sinCosto).toBe(1)
  })

  it('costo_por_gramo es por UNIDAD DE MEDIDA, no por gramo', () => {
    // En un lote de frascos es el costo del frasco. Por eso cantidad x costo
    // sirve para los dos y da exacto contra el total de la planilla.
    const soloFrascos = [lote({ id: 'X', codigo: 'R-CBD', gramos_totales: 2, unidad: 'u', costo_por_gramo: 35000 })]
    expect(resumenCatalogo(soloFrascos, [], []).invertido).toBe(70000)
  })
})

describe('materialSinLotear', () => {
  it('descuenta lo que ya esta puesto en lotes propios', () => {
    // El caso la organización del 27/08/2026: 15 cosechas de 21,4 g y ningun lote.
    expect(materialSinLotear(321, [])).toBe(321)
    expect(materialSinLotear(321, [lote({ origen: 'propio', gramos_totales: 200 })])).toBe(121)
    expect(materialSinLotear(321, [lote({ origen: 'propio', gramos_totales: 321 })])).toBe(0)
  })

  it('no cuenta lo comprado ni la produccion sin cosecha', () => {
    // Los dos entraron por su cuenta y ya suman al ingreso por separado.
    // Contarlos aca daria el material propio por lotado con material de otro
    // lado, que es justo el error que dejo un ano de cultivo propio cargado
    // como compra a terceros.
    expect(materialSinLotear(321, [
      lote({ origen: 'comprado', gramos_totales: 500 }),
      lote({ origen: 'propio_sin_cosecha', gramos_totales: 500 }),
    ])).toBe(321)
  })

  it('un lote sin origen se decide por su cosecha, igual que en el resto', () => {
    expect(materialSinLotear(100, [lote({ origen: null, cosecha_id: 'c1', gramos_totales: 40 })])).toBe(60)
    expect(materialSinLotear(100, [lote({ origen: null, cosecha_id: null, gramos_totales: 40 })])).toBe(100)
  })

  it('solo cuenta lo que se mide en gramos', () => {
    // Mismo bug que ya vivio en el catalogo: 21 frascos entrando al total como
    // si fueran 21 g.
    expect(materialSinLotear(100, [lote({ origen: 'propio', gramos_totales: 21, unidad: 'u' })])).toBe(100)
  })

  it('nunca da negativo', () => {
    // Mas lote propio que cosecha es otro problema —falta cargar una cosecha—
    // y de ese se ocupa el balance de materia. Un negativo aca se leeria como
    // «te sobra material», que no significa nada.
    expect(materialSinLotear(50, [lote({ origen: 'propio', gramos_totales: 300 })])).toBe(0)
  })
})
