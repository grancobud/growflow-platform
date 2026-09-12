// El PDF del documento emitido tiene que salir SIEMPRE.
//
// Es el último paso de emitir un recibo. Si explota, la persona que está en el
// mostrador con el paciente enfrente no puede darle el papel — y el motivo va a
// ser algo tan tonto como un signo que la fuente no sabe dibujar.
//
// Por eso los casos de acá son los feos: el texto con símbolos que vienen de la
// interfaz, el documento largo que pasa de hoja, el título vacío.

import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { pdfDelDocumento, nombreDePdf, aWinAnsi, registroDeEntidad, renglonesDelRegistro } from '../pdfDocumento'

const doc = (texto: string, titulo = 'Recibo N° 7') =>
  pdfDelDocumento({ titulo, texto, entidadNombre: 'Asociación Civil Ñandú', emitido: '22/08/2026' })

async function paginas(blob: Blob): Promise<number> {
  const pdf = await PDFDocument.load(await blob.arrayBuffer())
  return pdf.getPageCount()
}

describe('aWinAnsi', () => {
  it('deja pasar todo el castellano', () => {
    const t = 'Asociación Ñandú · «Señor» — 30° — año 2026 … ¿qué? ¡sí!'
    // Lo único que se toca del castellano es el punto medio, que se usa como
    // separador en la interfaz y no aporta nada en un documento impreso.
    expect(aWinAnsi(t)).toContain('Asociación Ñandú')
    expect(aWinAnsi(t)).toContain('«Señor»')
    expect(aWinAnsi(t)).toContain('30°')
    expect(aWinAnsi(t)).toContain('¿qué? ¡sí!')
  })

  it('traduce los signos de la interfaz en vez de tirarlos', () => {
    // Un ✓ en un documento quiere decir algo. Borrarlo cambia el sentido de la
    // línea; traducirlo lo conserva.
    expect(aWinAnsi('✓ firmado')).toBe('(si) firmado')
    expect(aWinAnsi('✗ sin firmar')).toBe('(no) sin firmar')
    expect(aWinAnsi('A → B')).toBe('A -> B')
  })

  it('saca lo que la fuente no sabe dibujar, sin romperse', () => {
    expect(aWinAnsi('recibo 🌿 emitido')).toBe('recibo  emitido')
    expect(aWinAnsi('')).toBe('')
  })

  it('conserva los saltos de línea, que son la forma del documento', () => {
    expect(aWinAnsi('uno\ndos\n\ntres')).toBe('uno\ndos\n\ntres')
  })
})

describe('pdfDelDocumento', () => {
  it('sale un PDF que se puede volver a abrir', async () => {
    const blob = await doc('Recibí la suma de pesos treinta y nueve mil.')
    expect(blob.type).toBe('application/pdf')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // La firma del formato. Un archivo de 0 bytes o un HTML de error también
    // se guardarían sin quejarse.
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
    expect(await paginas(blob)).toBe(1)
  })

  it('un documento largo se reparte en varias hojas', async () => {
    // El estatuto tiene 39 artículos: si el texto no pasa de hoja, se dibuja
    // todo encima del pie de la primera y no se entera nadie hasta imprimirlo.
    const largo = Array.from({ length: 300 }, (_, i) => `Artículo ${i + 1}. Texto del artículo.`).join('\n')
    expect(await paginas(await doc(largo))).toBeGreaterThan(1)
  })

  it('no explota con los símbolos que vienen de la interfaz', async () => {
    // Este es el que importa: pdf-lib no dibuja mal un carácter que no puede
    // codificar, TIRA. Y tirar acá es que no se pueda emitir el recibo.
    const feo = '✓ Entregado\n✗ Sin receta\nA → B\nemoji 🌿\nprecio 30° · ½'
    const blob = await doc(feo, 'Comprobante ✓ N° 12')
    expect(await paginas(blob)).toBe(1)
  })

  it('aguanta un documento vacío sin dejar de ser un PDF', async () => {
    expect(await paginas(await doc('', ''))).toBe(1)
  })
})

describe('nombreDePdf', () => {
  it('sale un nombre que cualquier sistema de archivos acepta', () => {
    expect(nombreDePdf('Recibo N° 7', '2026-08-22')).toBe('recibo-n-7-2026-08-22.pdf')
    expect(nombreDePdf('Acta N° 3 · para el libro', '2026-08-22'))
      .toBe('acta-n-3-para-el-libro-2026-08-22.pdf')
  })

  it('un título raro no deja el archivo sin nombre', () => {
    expect(nombreDePdf('', '2026-08-22')).toBe('documento-2026-08-22.pdf')
    expect(nombreDePdf('///', '2026-08-22')).toBe('documento-2026-08-22.pdf')
  })
})

// El bloque registral del membrete.
//
// Es lo que identifica a la persona juridica cuando el papel ya salio de la
// app: en una mesa de entradas nadie tiene la pantalla al lado. La regla dura
// es que lo que falta se OMITE — un «CUIT —» impreso dice que la asociacion no
// lo tiene, y lo que en realidad paso es que la pantalla no lo paso.
describe('registroDeEntidad', () => {
  const chaco = {
    cuit: '30-71234567-0',
    organismo_control: 'Inspeccion General de Personas Juridicas del Chaco',
    sede_domicilio: 'Av. Laprida 2265',
    sede_localidad: 'Resistencia',
    sede_provincia: 'Chaco',
    fecha_constitucion: '2026-02-11',
    reprocann_inscripcion: '2026-07-23',
  }

  it('arma la sede con las tres partes', () => {
    expect(registroDeEntidad(chaco)!.sede).toBe('Av. Laprida 2265, Resistencia, Chaco')
  })

  it('arma la sede con lo que haya: puede faltar la calle', () => {
    const r = registroDeEntidad({ ...chaco, sede_domicilio: null })!
    expect(r.sede).toBe('Resistencia, Chaco')
  })

  it('deja la sede en null si no hay ninguna parte, en vez de una cadena de comas', () => {
    const r = registroDeEntidad({ sede_domicilio: null, sede_localidad: null, sede_provincia: null })!
    expect(r.sede).toBeNull()
  })

  it('pasa las fechas a como se leen en un papel', () => {
    const r = registroDeEntidad(chaco)!
    expect(r.constitucion).toBe('11/02/2026')
    expect(r.reprocannInscripcion).toBe('23/07/2026')
  })

  it('no inventa una fecha cuando no hay', () => {
    // reprocann_vencimiento de Chaco esta en NULL al 27/08/2026: el papel no
    // puede decidir una fecha que la asociacion todavia no tiene.
    const r = registroDeEntidad({ ...chaco, fecha_constitucion: null })!
    expect(r.constitucion).toBeNull()
  })

  it('sin entidad no hay registro, y eso no es un error', () => {
    expect(registroDeEntidad(null)).toBeUndefined()
    expect(registroDeEntidad(undefined)).toBeUndefined()
  })
})

describe('el membrete con registro', () => {
  const con = (registro: ReturnType<typeof registroDeEntidad>) =>
    pdfDelDocumento({
      titulo: 'Acta N° 3', texto: 'En la ciudad de Resistencia...',
      entidadNombre: 'Asociacion Civil Cultivando Salud Chaco',
      emitido: '27/08/2026', registro,
    })

  it('el registro no empuja el documento a una hoja de mas', async () => {
    const blob = await con(registroDeEntidad({
      cuit: '30-71234567-0',
      organismo_control: 'Inspeccion General de Personas Juridicas y Registro Publico de Comercio del Chaco',
      sede_domicilio: 'Av. Laprida 2265', sede_localidad: 'Resistencia', sede_provincia: 'Chaco',
      fecha_constitucion: '2026-02-11', reprocann_inscripcion: '2026-07-23',
    }))
    expect(await paginas(blob)).toBe(1)
  })

  it('sin registro sale igual que antes: es opcional de verdad', async () => {
    const blob = await con(undefined)
    expect(blob.type).toBe('application/pdf')
    expect(await paginas(blob)).toBe(1)
  })

  it('con la entidad a medio cargar tampoco rompe', async () => {
    const blob = await con(registroDeEntidad({ sede_localidad: 'Resistencia' }))
    expect(await paginas(blob)).toBe(1)
  })
})

// Los renglones del bloque registral.
//
// Se prueban aparte de los dos que los dibujan porque son EL contrato entre el
// PDF y la vista de impresion: mientras los dos llamen a esta funcion, lo que
// se archiva y lo que se firma dicen lo mismo. Si alguien vuelve a armar la
// lista a mano en uno de los dos lados, estos casos siguen pasando y el papel
// igual diverge — asi que el test que importa de verdad es que haya UN solo
// lugar donde se arma, y eso lo sostiene el codigo, no el test.
describe('renglonesDelRegistro', () => {
  const chaco = registroDeEntidad({
    cuit: '30-71234567-0',
    organismo_control: 'Inspeccion General de Personas Juridicas del Chaco',
    sede_domicilio: 'Av. Laprida 2265',
    sede_localidad: 'Resistencia',
    sede_provincia: 'Chaco',
    fecha_constitucion: '2026-02-11',
    reprocann_inscripcion: '2026-07-23',
  })

  it('arma los dos renglones en orden', () => {
    expect(renglonesDelRegistro(chaco)).toEqual([
      'Av. Laprida 2265, Resistencia, Chaco - Constituida el 11/02/2026',
      'Inspeccion General de Personas Juridicas del Chaco - REPROCANN 23/07/2026',
    ])
  })

  it('el renglon que queda vacio no sale, en vez de un guion suelto', () => {
    const solo = registroDeEntidad({ sede_localidad: 'Resistencia' })
    expect(renglonesDelRegistro(solo)).toEqual(['Resistencia'])
  })

  it('sin registro no hay renglones', () => {
    expect(renglonesDelRegistro(undefined)).toEqual([])
  })

  it('con la entidad vacia no dibuja nada: ni rotulos ni rayas', () => {
    // Es la regla de fondo. Un «CUIT -» impreso dice que la asociacion no lo
    // tiene; lo que en realidad paso es que no se cargo.
    expect(renglonesDelRegistro(registroDeEntidad({}))).toEqual([])
  })
})
