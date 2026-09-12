// La lista de proveedores que se ofrece al cargar.
//
// El nombre del proveedor ES la clave: `v_saldo_proveedores` agrupa por ese
// texto. Una lista que ofrezca dos grafías del mismo proveedor no arregla nada
// —sigue partiendo los totales, sólo que ahora con ayuda del sistema—.

import { describe, it, expect } from 'vitest'
import { listaDeProveedores, proveedorYaExiste, normalizarProveedor, proveedoresPorRubro, esNoAplica } from '../proveedores'

const doc = (proveedor: string | null) => ({ proveedor })

describe('normalizarProveedor', () => {
  it('saca los espacios de sobra', () => {
    expect(normalizarProveedor('  Química   del   Litoral  ')).toBe('Química del Litoral')
  })

  it('el vacío y el nulo dan cadena vacía', () => {
    expect(normalizarProveedor(null)).toBe('')
    expect(normalizarProveedor('   ')).toBe('')
  })

  it('NO cambia mayúsculas', () => {
    // El nombre se muestra tal cual se cargó. Normalizar de más convertiría a
    // «Química del Litoral» en «química del litoral» en el recibo.
    expect(normalizarProveedor('PINAR')).toBe('PINAR')
  })
})

describe('listaDeProveedores', () => {
  it('junta las fuentes y no repite', () => {
    // Los comprobantes y los lotes nombran a los mismos proveedores. Mirar una
    // sola fuente haría que el nombre ofrecido dependa del formulario, que es
    // justo el problema a resolver.
    expect(listaDeProveedores([doc('Pinar')], [doc('Química del Litoral'), doc('Pinar')]))
      .toEqual(['Pinar', 'Química del Litoral'])
  })

  it('ordena alfabéticamente y en español', () => {
    // `localeCompare` con 'es': sin eso los acentos caen al final de la lista.
    expect(listaDeProveedores([doc('Zeta'), doc('Álamo'), doc('Beta')]))
      .toEqual(['Álamo', 'Beta', 'Zeta'])
  })

  it('ignora vacíos, nulos y espacios', () => {
    expect(listaDeProveedores([doc(null), doc(''), doc('   '), doc('Pinar')]))
      .toEqual(['Pinar'])
  })

  it('con dos grafías ofrece LA MÁS USADA', () => {
    // El caso real la organización: `Cristian` 149 veces y `CRISTIAN` un par. Ofrecer
    // la rara empujaría a seguir partiendo los totales.
    const lista = listaDeProveedores([doc('Pinar'), doc('Pinar'), doc('PINAR')])
    expect(lista).toEqual(['Pinar'])
  })

  it('a igual uso da lo mismo, venga en el orden que venga', () => {
    // Lo que este test cuida NO es cuál gana, sino que gane SIEMPRE la misma:
    // sin desempate explícito el resultado dependería del orden de inserción y
    // la lista se movería sola entre pantallas, ofreciendo hoy una grafía y
    // mañana la otra sobre los mismos datos.
    const a = listaDeProveedores([doc('PINAR'), doc('Pinar')])
    const b = listaDeProveedores([doc('Pinar'), doc('PINAR')])
    expect(a).toEqual(b)
    expect(a).toHaveLength(1)
  })

  it('trata los espacios de más como el mismo proveedor', () => {
    expect(listaDeProveedores([doc('Química del Litoral'), doc('Química  del  Litoral')]))
      .toEqual(['Química del Litoral'])
  })

  it('sin nada cargado devuelve la lista vacía', () => {
    // Es el estado de Chaco: 0 proveedores. El desplegable tiene que poder
    // arrancar vacío y ofrecer sólo «cargar uno nuevo».
    expect(listaDeProveedores([], [])).toEqual([])
  })
})

describe('proveedorYaExiste', () => {
  const lista = ['Pinar', 'Química del Litoral']

  it('encuentra el que ya está, escrito de otra forma', () => {
    expect(proveedorYaExiste('PINAR', lista)).toBe('Pinar')
    expect(proveedorYaExiste('  pinar ', lista)).toBe('Pinar')
  })

  it('devuelve undefined si es realmente nuevo', () => {
    expect(proveedorYaExiste('Vivero del Norte', lista)).toBeUndefined()
  })

  it('el vacío no existe', () => {
    expect(proveedorYaExiste('   ', lista)).toBeUndefined()
  })
})

// «N/A» no es un proveedor.
//
// Es el marcador de «no aplica» de los gastos operativos, y en la base de
// la organización hay 299 comprobantes con ese valor. Ofrecerlo en el desplegable mete
// una fila fantasma en el saldo de proveedores, que agrupa por ese mismo texto.
describe('esNoAplica', () => {
  it('reconoce las formas que aparecen en los datos', () => {
    expect(esNoAplica('N/A')).toBe(true)
    expect(esNoAplica('n/a')).toBe(true)
    expect(esNoAplica(' N/A ')).toBe(true)
    expect(esNoAplica('No aplica')).toBe(true)
  })

  it('no se come nombres reales que se le parecen', () => {
    // «NA» a secas puede ser un nombre o una sigla: por eso la lista es
    // explicita y no un patron amplio.
    expect(esNoAplica('NA')).toBe(false)
    expect(esNoAplica('Nadia')).toBe(false)
    expect(esNoAplica('')).toBe(false)
  })

  it('la lista no lo ofrece', () => {
    const docs = [{ proveedor: 'N/A' }, { proveedor: 'Pinar' }, { proveedor: 'N/A' }]
    expect(listaDeProveedores(docs)).toEqual(['Pinar'])
  })
})

// El rubro se DEDUCE de donde aparece el proveedor, porque no hay tabla donde
// guardarlo. Los fixtures son los nombres y las categorias reales la organización.
describe('proveedoresPorRubro', () => {
  it('quien tiene un lote es material', () => {
    const r = proveedoresPorRubro({
      lotes: [{ proveedor: 'Coop. la organización' }],
      documentos: [],
    })
    expect(r).toEqual([{ nombre: 'Coop. la organización', rubro: 'material' }])
  })

  it('quien tiene comprobantes de Aprovisionamiento es material aunque no tenga lote', () => {
    // Son cuatro casos reales en la organización: comprados a los que todavia no se les
    // cargo ningun lote. Con la senal del lote sola quedarian sin clasificar.
    const r = proveedoresPorRubro({
      lotes: [],
      documentos: [{ proveedor: 'Luciano Ferrari', categoria: 'Aprovisionamiento' }],
    })
    expect(r[0].rubro).toBe('material')
  })

  it('retribuciones y gastos operativos son insumos', () => {
    const r = proveedoresPorRubro({
      lotes: [],
      documentos: [
        { proveedor: 'Cristian', categoria: 'Retribucion' },
        { proveedor: 'Cristian', categoria: 'Gasto Operativo' },
      ],
    })
    expect(r).toEqual([{ nombre: 'Cristian', rubro: 'insumos' }])
  })

  it('las categorias del formulario tambien son insumos, no material', () => {
    // CATEGORIAS_GASTO ofrece «Sustrato» y «Nutrientes». Son productos, pero no
    // material dispensable: no van al grupo de quien vende para el lote.
    const r = proveedoresPorRubro({
      lotes: [],
      documentos: [{ proveedor: 'Pinar', categoria: 'Sustrato' }],
    })
    expect(r[0].rubro).toBe('insumos')
  })

  it('material gana sobre insumos cuando estan las dos senales', () => {
    // A quien vende material se le puede pagar ademas un flete. Sigue siendo de
    // quien se compra el material, que es como lo busca quien carga un lote.
    const r = proveedoresPorRubro({
      lotes: [{ proveedor: 'Mariela' }],
      documentos: [{ proveedor: 'Mariela', categoria: 'Gasto Operativo' }],
    })
    expect(r[0].rubro).toBe('material')
  })

  it('sin categoria no se deduce nada, y se dice null en vez de adivinar', () => {
    const r = proveedoresPorRubro({
      lotes: [],
      documentos: [{ proveedor: 'Gaston', categoria: null }],
    })
    expect(r).toEqual([{ nombre: 'Gaston', rubro: null }])
  })

  it('la grafia que se ofrece sigue siendo la mas usada', () => {
    // No se pierde el criterio de listaDeProveedores al sumarle el rubro.
    const r = proveedoresPorRubro({
      lotes: [],
      documentos: [
        { proveedor: 'Pinar', categoria: 'Sustrato' },
        { proveedor: 'Pinar', categoria: 'Sustrato' },
        { proveedor: 'PINAR', categoria: 'Sustrato' },
      ],
    })
    expect(r).toEqual([{ nombre: 'Pinar', rubro: 'insumos' }])
  })

  it('N/A tampoco entra aca', () => {
    const r = proveedoresPorRubro({
      lotes: [],
      documentos: [{ proveedor: 'N/A', categoria: 'Gasto Operativo' }],
    })
    expect(r).toEqual([])
  })
})
