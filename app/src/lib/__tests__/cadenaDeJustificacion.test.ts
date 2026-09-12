// La cadena que hay que poder mostrar entera.
//
// Una asociación de cultivo solidario no vende: cultiva POR CUENTA de sus
// socios, y cada socio le reembolsa la parte que le toca del costo. Toda la
// legalidad se apoya en esa frase, y la forma de probarla es una cadena donde
// cada eslabón justifica al siguiente:
//
//   socios → cupo de plantas del DT → biomasa → costos → reembolso
//
// Cada desajuste tiene un nombre feo, y por eso importa medirlo antes de que lo
// mida otro: más biomasa que plantas es material que entró de otro lado, y más
// ingresos que costos es lucro, que es donde se cae el «sin fines de lucro».
//
// Lo que se prueba acá es que cada eslabón se mide contra EL ANTERIOR, y que
// donde no se puede saber diga que no se puede saber en vez de inventar un
// tilde.

import { describe, it, expect } from 'vitest'
import { cadenaDeJustificacion, laCadenaCierra, type DatosCadena } from '../cadenaDeJustificacion'

const BASE: DatosCadena = {
  sociosVinculados: 10,
  plantasPorSocio: 9,
  plantasEnFloracion: 90,
  rindeEsperadoPorPlantaG: 100,
  gramosCosechados: 9000,
  gramosComprados: 0,
  gramosEntregados: 9000,
  costosOperativos: 1_000_000,
  ingresosDeReembolso: 1_000_000,
  deudaConProveedores: 0,
  lotesComprados: 0,
  lotesSinProveedor: 0,
  lotesSinAnalisis: 0,
  // El aporte cubre el costo del material y deja un margen que los gastos se
  // comen entero: 9000 g cobrados a $XX con material a $XX dan $XX.XXX de
  // margen contra $X.XXX.XXX de gastos.
  costoMaterialPorGramo: 100,
  gramosCobrados: 9000,
  aportesCobrados: 1_000_000,
  gastosNoMaterial: 1_000_000,
}

const esl = (d: DatosCadena, clave: string) =>
  cadenaDeJustificacion(d).find(e => e.clave === clave)!

describe('produccion propia contada como compra a terceros', () => {
  // El caso real la organización, 28/08/2026. Los dos son el MISMO error conceptual
  // en dos eslabones distintos, y los dos van contra el argumento que esta
  // pantalla existe para sostener: que la asociación cultiva para sus socios en
  // vez de comprar y revender.

  it('lo propio sin cosecha registrada suma a la biomasa, pero del lado propio', () => {
    const e = esl({ ...BASE, gramosCosechados: 100, gramosPropiosSinCosecha: 4_837,
      gramosComprados: 4_283 }, 'biomasa')
    // 100 + 4.837 + 4.283: el material existe y se cuenta entero.
    expect(e.valor).toBe(9_220)
    expect(e.nota).toContain('4.937 g del cultivo propio')
    expect(e.nota).toContain('4.283 g de proveedores')
  })

  // El cruce que hace una inspección: material propio contra lo que las plantas
  // declaradas pueden dar. Mirando sólo lo cosechado se le escapaba justo el
  // material sin cosecha detrás, que es el que más necesita contraste.
  it('lo propio sin cosecha también se contrasta contra el rinde', () => {
    const e = esl({ ...BASE, plantasEnFloracion: 10, rindeEsperadoPorPlantaG: 100,
      gramosCosechados: 100, gramosPropiosSinCosecha: 4_837, gramosComprados: 0 }, 'biomasa')
    // 4.937 g propios contra 1.000 g que pueden dar 10 plantas.
    expect(e.estado).toBe('no_cierra')
    expect(e.nota).toContain('3.937 g más')
  })

  it('sin el campo nuevo la biomasa es la de siempre', () => {
    const e = esl({ ...BASE, gramosCosechados: 100, gramosComprados: 400 }, 'biomasa')
    expect(e.valor).toBe(500)
  })
})

describe('cadenaDeJustificacion', () => {
  it('devuelve los seis eslabones, siempre en el mismo orden', () => {
    expect(cadenaDeJustificacion(BASE).map(e => e.clave))
      .toEqual(['socios', 'plantas', 'biomasa', 'costos', 'reembolso', 'margen'])
  })

  it('con todo proporcionado, la cadena entera cierra', () => {
    expect(cadenaDeJustificacion(BASE).every(e => e.estado === 'cierra')).toBe(true)
  })

  // ── socios → plantas ──────────────────────────────────────────────────────
  it('el cupo de plantas sale de los socios, no al revés', () => {
    expect(esl(BASE, 'socios').habilita).toBe(90)
  })

  it('más plantas en floración que las que los socios justifican NO cierra', () => {
    // Cultivo sin amparo: hay planta de más sin socio que la sostenga.
    const e = esl({ ...BASE, plantasEnFloracion: 120 }, 'plantas')
    expect(e.estado).toBe('no_cierra')
    expect(e.nota).toMatch(/30/)
  })

  it('menos plantas que el cupo cierra: nadie obliga a usarlo entero', () => {
    expect(esl({ ...BASE, plantasEnFloracion: 45 }, 'plantas').estado).toBe('cierra')
  })

  // ── plantas → biomasa ─────────────────────────────────────────────────────
  it('comprar el material NO es un error en sí: lo que falta es su respaldo', () => {
    // ESTE TEST DECÍA LO CONTRARIO Y ESTABA MAL. Daba por hecho que si el
    // material no salió del cultivo propio, la cadena se rompía. la organización contó
    // el 23/08/2026 que NUNCA cultivó: compró todo a proveedores y lo ofreció a
    // través de la asociación, y ahora se está formalizando. Con el criterio
    // viejo la cadena le quedaba rota para siempre y no le marcaba nada de lo
    // que de verdad le falta, que son los papeles de cada lote.
    const comprado = { ...BASE, gramosCosechados: 0, gramosComprados: 9000, lotesComprados: 10 }
    expect(esl(comprado, 'biomasa').estado).toBe('cierra')
    expect(esl({ ...comprado, lotesSinAnalisis: 10 }, 'biomasa').estado).toBe('no_cierra')
  })

  it('cosechar más de lo que las plantas pueden dar NO cierra', () => {
    // 90 plantas a 100 g dan 9.000. Si aparecen 20.000, sobran 11.000 sin origen.
    const e = esl({ ...BASE, gramosCosechados: 20000 }, 'biomasa')
    expect(e.estado).toBe('no_cierra')
  })

  it('sin rinde esperado no se puede juzgar la biomasa, y lo dice', () => {
    // El rinde por planta lo define el cultivo, no el sistema. Sin ese número
    // no hay contra qué comparar, y un tilde ahí sería inventado.
    const e = esl({ ...BASE, rindeEsperadoPorPlantaG: null }, 'biomasa')
    expect(e.estado).toBe('sin_datos')
  })

  // ── el material que no salio del cultivo propio ──────────────────────────
  //
  // la organización nunca cultivo: todo lo que entrego lo compro a proveedores y lo
  // ofrecio a traves de la asociacion. Eso NO es un error, es otro modelo — pero
  // se justifica distinto: si el material no salio de las plantas de los socios,
  // lo que lo respalda es de QUIEN vino y con que analisis.
  const COMPRADO: DatosCadena = {
    ...BASE, gramosCosechados: 0, gramosComprados: 9000, lotesComprados: 10,
  }

  it('comprar todo el material no es un error si cada lote tiene su respaldo', () => {
    const e = esl(COMPRADO, 'biomasa')
    expect(e.estado).toBe('cierra')
    expect(e.nota).toMatch(/proveedor/i)
  })

  it('un lote sin proveedor identificado rompe la cadena de origen', () => {
    const e = esl({ ...COMPRADO, lotesSinProveedor: 7 }, 'biomasa')
    expect(e.estado).toBe('no_cierra')
    expect(e.nota).toMatch(/7/)
    expect(e.comoSeArregla).toMatch(/proveedor/i)
  })

  it('un lote sin analisis de laboratorio tampoco cierra', () => {
    const e = esl({ ...COMPRADO, lotesSinAnalisis: 101 }, 'biomasa')
    expect(e.estado).toBe('no_cierra')
    expect(e.nota).toMatch(/101|análisis|analisis/i)
  })

  it('el rinde propio NO se le exige al material comprado', () => {
    // Sin cultivo propio, el rinde por planta no dice nada del material que
    // entro comprado: pedirlo dejaria la cadena trabada para siempre en una
    // asociacion que no cultiva.
    const e = esl({ ...COMPRADO, rindeEsperadoPorPlantaG: null }, 'biomasa')
    expect(e.estado).toBe('cierra')
  })

  // ── costos → reembolso ────────────────────────────────────────────────────
  it('reembolso parejo con los costos cierra', () => {
    expect(esl(BASE, 'reembolso').estado).toBe('cierra')
  })

  it('un desvío chico cierra: los gastos y los ingresos no caen el mismo día', () => {
    expect(esl({ ...BASE, ingresosDeReembolso: 1_030_000 }, 'reembolso').estado).toBe('cierra')
  })

  it('cobrar bastante más de lo que se gastó NO cierra', () => {
    // Es donde se cae el «sin fines de lucro»: si entra sistemáticamente más de
    // lo que sale, la diferencia hay que poder explicarla.
    const e = esl({ ...BASE, ingresosDeReembolso: 1_140_000 }, 'reembolso')
    expect(e.estado).toBe('no_cierra')
    expect(e.nota).toMatch(/140\.000|excedente/i)
  })

  it('gastar mucho más de lo que se reembolsa tampoco cierra', () => {
    // La otra punta: si la asociación pone plata que los socios no reembolsan,
    // hay que poder decir de dónde sale.
    expect(esl({ ...BASE, ingresosDeReembolso: 500_000 }, 'reembolso').estado).toBe('no_cierra')
  })

  it('sin costos cargados no se juzga el reembolso', () => {
    expect(esl({ ...BASE, costosOperativos: 0 }, 'reembolso').estado).toBe('sin_datos')
  })

  // ── la deuda, que es costo aunque todavia no salio de la caja ────────────
  it('lo que se le debe a proveedores cuenta como costo', () => {
    // El caso la organización al 23/08/2026: la caja mostraba $X,X M de excedente y
    // al mismo tiempo habia ~$XX M sin pagarle a proveedores. Mirando solo lo
    // que salio de la caja, el reembolso parecia de sobra; contando lo que se
    // debe, falta. El material ya se recibio y ya se entrego: ese costo existe
    // aunque el pago no haya salido.
    const e = esl({ ...BASE, deudaConProveedores: 500_000 }, 'costos')
    expect(e.valor).toBe(1_500_000)
    expect(e.nota).toMatch(/debe|deuda/i)
  })

  it('el reembolso se mide contra el costo con la deuda adentro', () => {
    // Mismo ingreso, misma caja: lo unico que cambia es que ahora se cuenta lo
    // que falta pagar. Sin la deuda cerraba; con la deuda, no.
    expect(esl(BASE, 'reembolso').estado).toBe('cierra')
    const e = esl({ ...BASE, deudaConProveedores: 500_000 }, 'reembolso')
    expect(e.estado).toBe('no_cierra')
    expect(e.nota).toMatch(/falta/i)
  })

  it('sin deuda, el eslabon de costos no habla de deuda', () => {
    expect(esl(BASE, 'costos').nota).not.toMatch(/debe|deuda/i)
  })

  // ── lo que hace que sirva ─────────────────────────────────────────────────
  it('el eslabón que no cierra dice cómo se arregla', () => {
    const rotos = cadenaDeJustificacion({
      ...BASE, gramosCosechados: 0, gramosComprados: 9000,
      lotesComprados: 10, lotesSinProveedor: 3,
    }).filter(e => e.estado === 'no_cierra')
    expect(rotos.length).toBeGreaterThan(0)
    for (const e of rotos) expect(e.comoSeArregla?.length ?? 0).toBeGreaterThan(20)
  })

  it('sin un solo socio la cadena no arranca y no finge que sí', () => {
    const c = cadenaDeJustificacion({ ...BASE, sociosVinculados: 0 })
    expect(c[0].estado).toBe('sin_datos')
  })
})

describe('margen', () => {
  it('cierra cuando el margen sobre el material no alcanza a cubrir los gastos', () => {
    // El caso real la organización: se cobran $X.XXX por gramo y el material cuesta
    // $X.XXX. Los $XX M de diferencia no llegan a los $X,X M de gastos, así que
    // no hay excedente que pueda ser lucro. Es la prueba de que cubre costos.
    const e = esl({ ...BASE, costoMaterialPorGramo: 8156, gramosCobrados: 6412,
      aportesCobrados: 63_293_539, gastosNoMaterial: 47_278_860 }, 'margen')
    expect(e.estado).toBe('cierra')
    expect(e.nota).toContain('no hay excedente')
  })

  it('no cierra cuando el margen deja plata de sobra', () => {
    const e = esl({ ...BASE, costoMaterialPorGramo: 1000, gramosCobrados: 1000,
      aportesCobrados: 5_000_000, gastosNoMaterial: 500_000 }, 'margen')
    expect(e.estado).toBe('no_cierra')
    expect(e.comoSeArregla).toBeTruthy()
  })

  it('sin el costo de los lotes dice que no se puede saber, no que cierra', () => {
    const e = esl({ ...BASE, costoMaterialPorGramo: null }, 'margen')
    expect(e.estado).toBe('sin_datos')
  })

  it('no divide el aporte entre los gramos entregados sin cargo', () => {
    // 6.412 g cobrados de 8.836 entregados. Si se reparte el aporte en todos,
    // el precio por gramo baja de $X.XXX a $X.XXX y el margen se ve negativo:
    // el eslabón diría que cierra por un motivo que no es cierto.
    const e = esl({ ...BASE, costoMaterialPorGramo: 8156, gramosCobrados: 6412,
      aportesCobrados: 63_293_539, gastosNoMaterial: 47_278_860 }, 'margen')
    expect(e.nota).toContain('$9.871')
    expect(e.nota).not.toContain('$7.164')
  })
})

describe('laCadenaCierra', () => {
  it('cierra sólo con los seis eslabones cerrados', () => {
    expect(laCadenaCierra(cadenaDeJustificacion(BASE))).toBe(true)
  })

  it('un eslabón roto la corta entera', () => {
    expect(laCadenaCierra(cadenaDeJustificacion({ ...BASE, ingresosDeReembolso: 2_000_000 })))
      .toBe(false)
  })

  it('LO QUE NO SE SABE NO CIERRA', () => {
    // Lo encontró un sabotaje: con `every(e => e.estado !== 'no_cierra')` los
    // quince tests seguían en verde, pero la app decía «la cadena cierra» cuando
    // en realidad faltaban datos para saberlo. Un tilde que miente es peor que
    // ninguno, y acá el tilde es justamente lo que se le muestra a un control.
    const sinRinde = cadenaDeJustificacion({ ...BASE, rindeEsperadoPorPlantaG: null })
    expect(sinRinde.some(e => e.estado === 'sin_datos')).toBe(true)
    expect(sinRinde.some(e => e.estado === 'no_cierra')).toBe(false)
    expect(laCadenaCierra(sinRinde)).toBe(false)
  })
})
