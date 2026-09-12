// Tests de las funciones que calculan plata y material.
//
// POR QUE ESTAS Y NO OTRAS
// Son las que se construyeron contrastando la planilla la organización hoja por hoja
// el 20 y 21/08/2026. Cada una se verificó UNA vez, a mano, contra un número
// real. Sin test, la próxima persona que toque un `filter` no se entera de que
// movió un total de millones.
//
// LOS FIXTURES SON NUMEROS REALES DE PRODUCCION, a propósito. Un test con datos
// inventados prueba que la función hace lo que hace; con los reales prueba que
// sigue dando lo que la organización ya vio en pantalla y dio por bueno.

import { describe, it, expect } from 'vitest'
import {
  balanceMateria, saldoDeLotes, produccionPorProductor, retirosPorSocio, aportePromedio,
  movimientosPorCategoria, gastosPorConcepto, resumenCaja, enRango,
  type Dispensa, type DocumentoONG, type AsientoCaja, type LoteIngreso, sinAcentos } from '../ong'

let n = 0
const disp = (o: Partial<Dispensa>): Dispensa =>
  ({ id: String(++n), fecha: '2026-08-01', gramos: 0, ...o }) as Dispensa

describe('balanceMateria', () => {
  it('suma lo comprado ademas de lo cosechado', () => {
    // El bug real: la organización no cultiva, compra. Con sólo cosechas el balance daba
    // "inconsistente" para siempre porque ingresaba 0 y salía todo.
    const lotes: LoteIngreso[] = [
      { gramos_totales: 100, origen: 'comprado', unidad: 'g' },
      { gramos_totales: 50, origen: 'comprado', unidad: 'g' },
    ]
    const r = balanceMateria(0, [disp({ gramos: 30, unidad: 'g' })], lotes)
    expect(r.comprado).toBe(150)
    expect(r.ingresado).toBe(150)
    expect(r.stock).toBe(120)
  })

  it('deja afuera lo que no se mide en gramos', () => {
    // 6 lotes en frascos entraban al total como si fueran gramos.
    const lotes: LoteIngreso[] = [
      { gramos_totales: 100, origen: 'comprado', unidad: 'g' },
      { gramos_totales: 20, origen: 'comprado', unidad: 'u' },
    ]
    const ds = [disp({ gramos: 10, unidad: 'g' }), disp({ gramos: 5, unidad: 'u' })]
    const r = balanceMateria(0, ds, lotes)
    expect(r.comprado).toBe(100)
    expect(r.dispensado).toBe(10)
    expect(r.fueraDeBalance).toBe(1)
  })

  it('no cuenta dos veces un lote nacido de una cosecha propia', () => {
    const lotes: LoteIngreso[] = [{ gramos_totales: 80, cosecha_id: 'c1', unidad: 'g' }]
    expect(balanceMateria(80, [], lotes).ingresado).toBe(80)
  })
})

describe('produccionPorProductor', () => {
  // Números de producción al 21/08/2026.
  const lotes: LoteIngreso[] = [
    { gramos_totales: 3146, unidad: 'g', proveedor: 'Coop. la organización' },
    { gramos_totales: 2, unidad: 'u', proveedor: 'Coop. la organización' },
    { gramos_totales: 1300, unidad: 'g', proveedor: 'Mariela' },
    { gramos_totales: 50, unidad: 'u', proveedor: 'Adri Montes' },
    { gramos_totales: 94, unidad: 'g', proveedor: null },
  ]

  it('suma solo gramos y cuenta aparte las otras unidades', () => {
    // La planilla da 3.150 para Coop. la organización porque cuenta los frascos como gramos.
    const coop = produccionPorProductor(lotes).find(x => x.productor === 'Coop. la organización')!
    expect(coop.gramos).toBe(3146)
    expect(coop.otrasUnidades).toBe(1)
    expect(coop.lotes).toBe(2)
  })

  it('los 50 de Adri Montes son unidades, no gramos', () => {
    // A-PR25726: la planilla los suma como 50 g y por eso le da 242,5.
    const adri = produccionPorProductor(lotes).find(x => x.productor === 'Adri Montes')!
    expect(adri.gramos).toBe(0)
    expect(adri.otrasUnidades).toBe(1)
  })

  it('sin proveedor cae en Inventario inicial, como lo llama la planilla', () => {
    expect(produccionPorProductor(lotes).some(x => x.productor === 'Inventario inicial')).toBe(true)
  })

  it('ordena de mayor a menor', () => {
    expect(produccionPorProductor(lotes)[0].productor).toBe('Coop. la organización')
  })
})

describe('retirosPorSocio', () => {
  const docs = [
    { categoria: 'Retribucion', proveedor: 'Cristian', monto: 8833000, fecha: '2026-08-19' },
    { categoria: 'Retribucion', proveedor: 'Hugo', monto: 7934870, fecha: '2026-08-09' },
    { categoria: 'Retribucion', proveedor: 'N/A', monto: 55000, fecha: '2026-08-01' },
    { categoria: 'Insumos', proveedor: 'Otro', monto: 99999, fecha: '2026-08-01' },
  ] as DocumentoONG[]

  it('da los totales exactos de la planilla', () => {
    const r = retirosPorSocio(docs)
    expect(r.map(x => [x.socio, x.total])).toEqual([['Cristian', 8833000], ['Hugo', 7934870]])
  })

  it('ignora N/A, que no es un socio sino no-aplica', () => {
    // Contarlo lo mostraría como el que más cobró.
    expect(retirosPorSocio(docs).some(x => x.socio === 'N/A')).toBe(false)
  })

  it('ignora lo que no es retribucion', () => {
    expect(retirosPorSocio(docs).some(x => x.socio === 'Otro')).toBe(false)
  })
})

describe('aportePromedio', () => {
  it('divide solo por las entregas que aportaron', () => {
    // El KPI de la planilla divide por TODAS, incluyendo consumo interno y
    // merma, y por eso da 29% menos.
    const ds = [
      disp({ aporte: 100000, gramos: 10, unidad: 'g' }),
      disp({ aporte: 100000, gramos: 10, unidad: 'g' }),
      disp({ aporte: 0, gramos: 5, unidad: 'g' }),
      disp({ aporte: 0, gramos: 5, unidad: 'g' }),
    ]
    const r = aportePromedio(ds)
    expect(r.conAporte).toBe(2)
    expect(r.sinAporte).toBe(2)
    expect(r.porEntrega).toBe(100000)   // no 50.000, que seria dividir por 4
  })

  it('sin ninguna que aporte devuelve null y no NaN', () => {
    expect(aportePromedio([disp({ aporte: 0 })]).porEntrega).toBeNull()
  })
})

describe('movimientosPorCategoria', () => {
  const caja = [
    { tipo: 'egreso', detalle: 'PAGO A PROVEEDOR', monto: 25234000 },
    { tipo: 'egreso', detalle: 'Gasto Operativo', monto: 19642990 },
    { tipo: 'egreso', detalle: 'Shuga | REVERSA de un ingreso', monto: 381000 },
    { tipo: 'ingreso', detalle: 'Cookies', monto: 21695000 },
  ] as AsientoCaja[]

  it('separa entradas de salidas', () => {
    // En los egresos el detalle es la categoría del gasto; en los ingresos, la
    // variedad. Mezclarlos daría un ranking sin sentido.
    const r = movimientosPorCategoria(caja)
    expect(r.salidas).toHaveLength(3)
    expect(r.entradas).toHaveLength(1)
  })

  it('pliega la reversa en su categoria real', () => {
    // Sin esto cada reversa abre una fila propia y el ranking se llena de ruido.
    const r = movimientosPorCategoria(caja)
    expect(r.salidas.find(x => x.categoria === 'Shuga')?.monto).toBe(381000)
    expect(r.salidas.some(x => x.categoria.indexOf('REVERSA') >= 0)).toBe(false)
  })
})

describe('gastosPorConcepto', () => {
  // El caso real: los dos gastos más caros partidos en varias grafías.
  const docs = [
    ...Array.from({ length: 14 }, () => ({ categoria: 'Gasto Operativo', descripcion: 'Alquiler', monto: 350000 })),
    ...Array.from({ length: 4 }, () => ({ categoria: 'Gasto Operativo', descripcion: 'alquiler', monto: 162525 })),
    ...Array.from({ length: 20 }, () => ({ categoria: 'Gasto Operativo', descripcion: 'Viaticos', monto: 14300 })),
    ...Array.from({ length: 19 }, () => ({ categoria: 'Gasto Operativo', descripcion: 'Viáticos', monto: 15210 })),
    { categoria: 'Retribucion', descripcion: 'Retiro', monto: 100000 },
  ] as DocumentoONG[]

  it('junta las grafias y da el total real', () => {
    // 14 x 350.000 + 4 x 162.525 = 5.550.100, el número de producción.
    const alq = gastosPorConcepto(docs, 'Gasto Operativo').find(x => /alquiler/i.test(x.concepto))!
    expect(alq.comprobantes).toBe(18)
    expect(alq.monto).toBe(5550100)
    expect(alq.grafias).toBe(2)
  })

  it('ignora acentos: Viaticos con y sin tilde son lo mismo', () => {
    const v = gastosPorConcepto(docs, 'Gasto Operativo').find(x => /vi[aá]ticos/i.test(x.concepto))!
    expect(v.comprobantes).toBe(39)
    expect(v.grafias).toBe(2)
  })

  it('muestra la grafia mas usada, no la clave normalizada', () => {
    // Alquiler (14) le gana a alquiler (4).
    const alq = gastosPorConcepto(docs, 'Gasto Operativo').find(x => /alquiler/i.test(x.concepto))!
    expect(alq.concepto).toBe('Alquiler')
  })

  it('no mezcla rubros', () => {
    expect(gastosPorConcepto(docs, 'Gasto Operativo').some(x => x.concepto === 'Retiro')).toBe(false)
  })
})

describe('resumenCaja y enRango', () => {
  const caja = [
    { fecha: '2026-08-01', tipo: 'ingreso', medio: 'Efectivo', monto: 45000 },
    { fecha: '2026-08-01', tipo: 'egreso', medio: 'Transferencia', monto: 138500 },
    { fecha: '2026-07-01', tipo: 'ingreso', medio: 'Efectivo', monto: 500000 },
  ] as AsientoCaja[]

  it('filtra por rango inclusive en los dos extremos', () => {
    expect(enRango(caja, '2026-08-01', '2026-08-01')).toHaveLength(2)
  })

  it('sin desde ni hasta devuelve todo', () => {
    expect(enRango(caja, '', '')).toHaveLength(3)
  })

  it('el neto es entradas menos salidas', () => {
    const r = resumenCaja(enRango(caja, '2026-08-01', '2026-08-01'))
    expect(r.neto).toBe(45000 - 138500)
  })

  // El arqueo muestra el saldo abierto por medio, y durante un tiempo mostro
  // SOLO efectivo y transferencia. En la organización eso escondia 92 asientos por
  // $X,X M —«Mixto», sin medio, y un «Tranferencia» mal escrito— debajo de un
  // texto que decia que eso era el arqueo.
  //
  // El invariante que lo impide es aritmetico y no depende de que medios haya:
  // los tres netos tienen que sumar el neto total.
  it('los netos por medio suman el neto total, con medios fuera de la lista', () => {
    const conRaros = [
      ...caja,
      { fecha: '2026-08-02', tipo: 'ingreso', medio: 'Mixto', monto: 120000 },
      { fecha: '2026-08-02', tipo: 'egreso', medio: null, monto: 33000 },
      { fecha: '2026-08-02', tipo: 'egreso', medio: 'Tranferencia', monto: 20000 },
    ] as AsientoCaja[]
    const r = resumenCaja(conRaros)
    expect(r.netoOtros).toBe(120000 - 33000 - 20000)
    expect(r.netoEfectivo + r.netoTransferencia + r.netoOtros).toBe(r.neto)
  })
})

describe('sinAcentos', () => {
  it('iguala las dos formas de escribir un cargo', () => {
    // El cargo de una autoridad lo escribe una persona, y «Responsable Tecnico»
    // y «Responsable Técnico» son la misma palabra para ella. La declaracion
    // jurada busca al responsable tecnico por substring del cargo; con /tecnic/i
    // la forma acentuada NO matcheaba, asi que quien lo escribia BIEN terminaba
    // con una declaracion firmada por «[nombre del responsable tecnico]» y sin
    // ninguna pista de por que.
    const busca = (cargo: string) =>
      sinAcentos(cargo).toLowerCase().includes('tecnic')

    expect(busca('Responsable Técnico')).toBe(true)
    expect(busca('Responsable Tecnico')).toBe(true)
    expect(busca('responsable tecnico')).toBe(true)
    expect(busca('Tesorera')).toBe(false)
  })

  it('deja el resto del texto intacto', () => {
    expect(sinAcentos('Direccion Medica')).toBe('Direccion Medica')
    expect(sinAcentos('Dirección Médica')).toBe('Direccion Medica')
    expect(sinAcentos('')).toBe('')
  })
})

describe('saldoDeLotes', () => {
  const lts: LoteIngreso[] = [
    { codigo: 'L-01', gramos_totales: 500, unidad: 'g' },
    { codigo: 'L-02', gramos_totales: 300, unidad: 'g' },
  ]

  it('descuenta del lote lo que se entrego de ese lote', () => {
    const r = saldoDeLotes(lts, [
      disp({ gramos: 120, lote_codigo: 'L-01' }),
      disp({ gramos: 30, lote_codigo: 'L-01' }),
      disp({ gramos: 300, lote_codigo: 'L-02' }),
    ])
    expect(r.find(x => x.codigo === 'L-01')?.restante).toBe(350)
    // Entregado entero: queda en cero, no negativo. Es el caso que hace que el
    // desplegable deje de ofrecerlo.
    expect(r.find(x => x.codigo === 'L-02')?.restante).toBe(0)
  })

  it('aparea el codigo aunque venga con espacios o en otra caja', () => {
    // El cruce de sobregiro comparaba el codigo CRUDO. Un lote cargado como
    // « l-01 » no encontraba sus entregas y figuraba lleno: 500 g que en la
    // realidad ya no estaban.
    const r = saldoDeLotes(lts, [disp({ gramos: 200, lote_codigo: ' l-01 ' })])
    expect(r.find(x => x.codigo === 'L-01')?.entregado).toBe(200)
    expect(r.find(x => x.codigo === 'L-01')?.restante).toBe(300)
  })

  it('el sobregiro queda en negativo, no en cero', () => {
    // Es lo que lee el cruce de lotes sobregirados. Recortarlo a cero taparia
    // justamente lo que ese cruce existe para encontrar.
    const r = saldoDeLotes(lts, [disp({ gramos: 560, lote_codigo: 'L-01' })])
    expect(r.find(x => x.codigo === 'L-01')?.restante).toBe(-60)
  })

  it('ignora las entregas que no declaran lote', () => {
    // No se pueden imputar a ninguno. Repartirlas seria inventar de donde
    // salio el material; de ese agujero se ocupa el balance de materia.
    const r = saldoDeLotes(lts, [
      disp({ gramos: 99, lote_codigo: null }),
      disp({ gramos: 99, lote_codigo: '  ' }),
    ])
    expect(r.every(x => x.entregado === 0)).toBe(true)
  })

  it('un lote desactivado sigue teniendo saldo: filtrarlo es cosa de la pantalla', () => {
    // `saldoDeLotes` es una cuenta, no una decision de que ofrecer. Un lote
    // retirado del catalogo que quedo SOBREGIRADO sigue siendo un error que hay
    // que ver, y el cruce de sobregiro lee esta misma cuenta: si filtrara por
    // `activo`, desactivar un lote taparia su sobregiro.
    const r = saldoDeLotes([{ codigo: 'L-09', gramos_totales: 50, unidad: 'g', activo: false }],
      [disp({ gramos: 80, lote_codigo: 'L-09' })])
    expect(r[0].restante).toBe(-30)
  })

  it('deja afuera los lotes sin codigo', () => {
    // Sin codigo no hay con que aparear la entrega, asi que ofrecerlo en el
    // desplegable seria ofrecer algo que despues no descuenta de nada.
    const r = saldoDeLotes([{ gramos_totales: 100, unidad: 'g' }], [])
    expect(r).toEqual([])
  })
})
