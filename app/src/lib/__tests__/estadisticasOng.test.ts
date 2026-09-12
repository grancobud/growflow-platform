// Las cuentas de la asociación.
//
// Lo que se prueba acá no es la aritmética —sumar montos no se rompe solo— sino
// las tres decisiones que cambian lo que la pantalla dice:
//   · el mes sin movimientos aparece igual, con cero
//   · las dos grafías del mismo concepto suman juntas
//   · lo que no se puede calcular es null, no cero

import { describe, it, expect } from 'vitest'
import {
  mesesEntre, serieMensual, porRubro, rubroDe, repartoPor,
  concentracion, porDiaDeSemana, resumenPersonas, topProductos, personasQueVuelven,
  dividir, ultimos,
} from '../estadisticasOng'
import type { AsientoCaja, Dispensa } from '../ong'
import type { Paciente } from '../registro'

const asiento = (fecha: string, tipo: 'ingreso' | 'egreso', monto: number, concepto = 'X'): AsientoCaja =>
  ({ id: fecha + concepto + monto, fecha, tipo, concepto, monto })

const entrega = (fecha: string, gramos: number, aporte: number, paciente_id?: string, producto?: string): Dispensa =>
  ({ id: fecha + (paciente_id ?? '') + gramos, fecha, gramos, aporte, paciente_id, producto } as Dispensa)

describe('los meses de la serie', () => {
  it('trae todos los meses del rango, cruzando el año', () => {
    expect(mesesEntre('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('un mes sin nada aparece igual, en cero', () => {
    // Si la serie se armara sólo con los meses presentes, el gráfico pondría
    // agosto al lado de octubre y se leería como dos meses seguidos.
    const serie = serieMensual(
      [asiento('2026-08-02', 'ingreso', 100), asiento('2026-10-02', 'ingreso', 300)], [], [])
    expect(serie.map(m => m.clave)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(serie[1]).toMatchObject({ clave: '2026-09', ingresos: 0, egresos: 0, resultado: 0 })
  })

  it('el saldo se arrastra de un mes al siguiente', () => {
    const serie = serieMensual([
      asiento('2026-01-05', 'ingreso', 1000),
      asiento('2026-01-06', 'egreso', 400),
      asiento('2026-02-05', 'egreso', 200),
    ], [], [])
    expect(serie.map(m => m.resultado)).toEqual([600, -200])
    expect(serie.map(m => m.saldo)).toEqual([600, 400])
  })

  it('la misma persona que retira cinco veces cuenta una', () => {
    const serie = serieMensual([], [
      entrega('2026-03-01', 10, 100, 'p1'), entrega('2026-03-08', 10, 100, 'p1'),
      entrega('2026-03-09', 10, 100, 'p2'),
    ], [])
    expect(serie[0]).toMatchObject({ entregas: 3, personas: 2, gramos: 30 })
  })

  it('las altas se acumulan mes a mes', () => {
    const serie = serieMensual([], [], [
      { fecha_alta: '2026-01-10' }, { fecha_alta: '2026-01-20' }, { fecha_alta: '2026-03-01' },
    ])
    expect(serie.map(m => [m.clave, m.altas, m.acumuladas]))
      .toEqual([['2026-01', 2, 2], ['2026-02', 0, 2], ['2026-03', 1, 3]])
  })

  it('sin datos no hay serie, y no explota', () => {
    expect(serieMensual([], [], [])).toEqual([])
  })

  it('una fecha absurda no cuelga la pantalla', () => {
    // Con un año 1900 en la base, un bucle sin tope arma 1500 meses.
    expect(mesesEntre('1900-01', '2026-08').length).toBeLessThanOrEqual(600)
  })
})

describe('los rubros de la caja', () => {
  it('las dos grafías del mismo concepto suman juntas', () => {
    // El caso real: «Retribucion» 171 asientos y «Retribución» 14. Separados,
    // ninguno de los dos números es el gasto que hubo.
    const r = porRubro([
      asiento('2026-01-01', 'egreso', 100, 'Retribucion'),
      asiento('2026-01-02', 'egreso', 50, 'Retribución'),
    ], 'egreso')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ total: 150, n: 2 })
  })

  it('muestra la grafía que más se usó, no la primera que apareció', () => {
    const r = porRubro([
      asiento('2026-01-01', 'egreso', 10, 'Retribución'),
      asiento('2026-01-02', 'egreso', 10, 'Retribucion'),
      asiento('2026-01-03', 'egreso', 10, 'Retribucion'),
    ], 'egreso')
    expect(r[0].etiqueta).toBe('Retribucion')
  })

  it('las entregas y los pagos se juntan en un rubro, no en noventa conceptos', () => {
    expect(rubroDe('Dispensa a PAC-003')).toBe('Entregas a personas')
    expect(rubroDe('Pago a Mariela')).toBe('Pagos a cultivo')
    expect(rubroDe('Alquiler')).toBe('Alquiler')
  })

  it('no mezcla ingresos con egresos', () => {
    const caja = [asiento('2026-01-01', 'ingreso', 100, 'Donación'),
                  asiento('2026-01-02', 'egreso', 40, 'Alquiler')]
    expect(porRubro(caja, 'ingreso').map(r => r.etiqueta)).toEqual(['Donación'])
    expect(porRubro(caja, 'egreso').map(r => r.etiqueta)).toEqual(['Alquiler'])
  })

  it('las partes suman uno', () => {
    const r = porRubro([asiento('2026-01-01', 'egreso', 75, 'A'), asiento('2026-01-02', 'egreso', 25, 'B')], 'egreso')
    expect(r.reduce((s, x) => s + x.parte, 0)).toBeCloseTo(1)
  })
})

describe('lo que no se puede calcular', () => {
  it('no es cero: es que no se sabe', () => {
    expect(dividir(10, 0)).toBeNull()
    expect(dividir(10, 2)).toBe(5)
  })

  it('sin aportes no hay concentración', () => {
    expect(concentracion([entrega('2026-01-01', 10, 0, 'p1')])).toMatchObject({ parteTop10: null, personas: 0 })
  })

  it('sin entregas recientes no hay porcentaje de gente que vuelve', () => {
    expect(personasQueVuelven([], '2026-08-22').parte).toBeNull()
  })
})

describe('de cuánta gente depende la asociación', () => {
  it('el acumulado termina en el total', () => {
    const c = concentracion([
      entrega('2026-01-01', 1, 100, 'p1'), entrega('2026-01-01', 1, 300, 'p2'),
      entrega('2026-01-01', 1, 600, 'p3'),
    ])
    expect(c.personas).toBe(3)
    expect(c.curva[c.curva.length - 1].parteAcum).toBeCloseTo(1)
    // Ordenada de mayor a menor: la primera es la que más aporta.
    expect(c.curva[0].parteAcum).toBeCloseTo(0.6)
  })

  it('la gente que vuelve se cuenta contra la que ya estaba', () => {
    const r = personasQueVuelven([
      entrega('2026-01-01', 1, 10, 'vieja'),      // hace rato
      entrega('2026-08-01', 1, 10, 'vieja'),      // y volvió
      entrega('2026-08-02', 1, 10, 'nueva'),      // primera vez
    ], '2026-08-22')
    expect(r).toMatchObject({ recientes: 2, vuelven: 1, nuevas: 1 })
    expect(r.parte).toBeCloseTo(0.5)
  })
})

describe('el resto', () => {
  it('el día de la semana no se corre por la zona horaria', () => {
    // 2026-08-02 es domingo. Leído como UTC en Argentina daría sábado.
    const d = porDiaDeSemana([entrega('2026-08-02', 1, 1)])
    expect(d.find(x => x.dia === 'dom')!.n).toBe(1)
    expect(d.find(x => x.dia === 'sáb')!.n).toBe(0)
  })

  it('el REPROCANN vencido no cuenta como vigente', () => {
    const p = (o: Partial<Paciente>) => o as Paciente
    const r = resumenPersonas([
      p({ reprocann_estado: 'Vigente', reprocann_vencimiento: '2026-09-01' }),  // vigente
      p({ reprocann_estado: 'Vigente', reprocann_vencimiento: '2026-01-01' }),  // ya vencido
      p({ reprocann_estado: 'Sin registro' }),
    ], '2026-08-22')
    expect(r).toMatchObject({ reprocannVigente: 1, reprocannVencido: 1, reprocannSinRegistro: 1 })
    expect(r.reprocannPorVencer).toBe(1)   // 2026-09-01 cae dentro de los 60 días
  })

  it('el reparto agrupa lo vacío en «Sin especificar»', () => {
    const r = repartoPor([{ m: 'Efectivo' }, { m: '' }, { m: null }], x => x.m)
    expect(r.find(x => x.etiqueta === 'Sin especificar')!.n).toBe(2)
  })

  it('los productos salen ordenados por gramos', () => {
    const t = topProductos([
      entrega('2026-01-01', 5, 0, 'p', 'Cookies'),
      entrega('2026-01-02', 50, 0, 'p', 'Shuga'),
      entrega('2026-01-03', 10, 0, 'p', 'Cookies'),
    ])
    expect(t.map(x => x.producto)).toEqual(['Shuga', 'Cookies'])
    expect(t[1]).toMatchObject({ gramos: 15, n: 2 })
  })

  it('el acumulado de los últimos meses no se pasa del largo de la serie', () => {
    const serie = serieMensual([asiento('2026-08-01', 'ingreso', 100)], [], [])
    expect(ultimos(serie, 12)).toMatchObject({ meses: 1, ingresos: 100 })
  })
})
