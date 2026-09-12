// El PDF del documento emitido: el archivo que queda, no la pantalla.
//
// POR QUE UN PDF Y NO EL TEXTO SOLO
// Al emitir ya se guarda el texto congelado en la ficha, y con eso alcanza para
// reimprimirlo idéntico. Pero un registro que sólo existe adentro de la app no
// se puede mandar por mail, ni adjuntar a un expediente, ni entregar en una
// mesa de entradas. El PDF es el que sale de la app y sigue valiendo afuera.
//
// POR QUE TEXTO Y NO UNA IMAGEN DE LA PANTALLA
// Rasterizar la vista sería más fiel al pixel y mucho peor como registro: pesa
// diez veces más, no se puede buscar, no se puede copiar, y al ampliarlo se ve
// borroso. Un documento legal tiene que poder leerse y citarse.
//
// EL FORMATO SIGUE AL DE IMPRESION A PROPOSITO
// Mismo membrete, misma tipografía con serifa para el cuerpo, mismo pie con
// numeración. Lo que se archiva y lo que se firma en papel tienen que ser
// reconocibles como el mismo papel; si no, en una inspección hay que explicar
// por qué difieren.

import { EMBLEMA } from './marca'

/** A4 en puntos, que es la unidad de PDF. */
const ANCHO = 595.28
const ALTO = 841.89

// Los mismos márgenes que la hoja impresa: 2,2cm arriba, 2cm a los lados,
// 2,4cm abajo.
const M_SUP = 62
const M_LAT = 57
const M_INF = 68

const VERDE = { r: 0.302, g: 0.486, b: 0.059 }   // #4d7c0f, el filete del membrete
const VERDE_OSCURO = { r: 0.102, g: 0.180, b: 0.020 } // #1a2e05, los títulos
const GRIS = { r: 0.471, g: 0.443, b: 0.424 }    // #78716c, el pie

const CUERPO = 10.5
const INTERLINEA = 15.5

/**
 * Alto del emblema en el membrete, en puntos.
 *
 * Los 46 px de la hoja impresa a 96 dpi son 34,5 pt. Se redondea a 34 para que
 * el logo entre justo entre el borde superior del texto y el filete verde, que
 * están separados 32 pt.
 */
const LOGO_ALTO = 34
/** Aire entre el emblema y el nombre de la entidad. */
const LOGO_AIRE = 12

/**
 * Deja el texto en lo que las fuentes estándar del PDF saben escribir.
 *
 * Las fuentes base de PDF codifican en WinAnsi, que cubre todo el castellano
 * —acentos, eñes, comillas angulares, el símbolo de grado— pero no los signos
 * que se cuelan desde la interfaz: un ✓ de una lista, una flecha, un emoji. Con
 * uno solo de esos, pdf-lib no dibuja mal: TIRA. Y tirar acá significa que
 * alguien no pudo emitir un recibo.
 *
 * Por eso se limpia antes y no se confía en que el texto venga limpio.
 */
export function aWinAnsi(t: string): string {
  const reemplazos: Record<string, string> = {
    '✓': '(si)', '✔': '(si)', '✗': '(no)', '✘': '(no)',
    '→': '->', '←': '<-', '↔': '<->', '·': '-',
    // Los espacios raros van escritos como codigo a proposito: tal cual son
    // indistinguibles de un espacio comun leyendo el archivo, y quien venga
    // despues los borraria sin saber que eran.
    '\u00a0': ' ', '\u202f': ' ', '\u2009': ' ',
  }
  let s = ''
  for (const c of t.replace(/[✓✔✗✘→←↔·\u00a0\u202f\u2009]/g, m => reemplazos[m] ?? m)) {
    const n = c.codePointAt(0) ?? 0
    // ASCII imprimible, el salto de línea, Latin-1 alto, y los especiales de
    // WinAnsi (comillas tipográficas, guiones largos, puntos suspensivos).
    const seguro = c === '\n' || (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) ||
      '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.includes(c)
    s += seguro ? c : ''
  }
  return s
}

/** Corta un párrafo en renglones que entran en el ancho útil. */
function renglones(
  texto: string, medir: (t: string) => number, ancho: number,
): string[] {
  const salida: string[] = []
  // Los saltos que ya trae el documento se respetan: el texto viene formateado,
  // con sus apartados y su sangría. Re-flowearlo entero lo desarma.
  for (const parrafo of texto.split('\n')) {
    if (parrafo.trim() === '') { salida.push(''); continue }
    let linea = ''
    for (const palabra of parrafo.split(' ')) {
      const prueba = linea ? `${linea} ${palabra}` : palabra
      if (medir(prueba) <= ancho || !linea) linea = prueba
      else { salida.push(linea); linea = palabra }
    }
    salida.push(linea)
  }
  return salida
}

/**
 * Los datos registrales que van en el membrete, debajo del filete.
 *
 * POR QUE ESTAN EN EL PAPEL Y NO SOLO EN LA APP
 * Un acta o una constancia salen de la app y siguen circulando afuera: se
 * presentan en una mesa de entradas, se adjuntan a un expediente. Ahí, quien
 * la recibe no tiene forma de saber de qué persona jurídica es el papel. El
 * CUIT y el organismo de control son lo que la identifican.
 */
export interface RegistroMembrete {
  cuit?: string | null
  organismoControl?: string | null
  sede?: string | null
  constitucion?: string | null
  reprocannInscripcion?: string | null
}

/**
 * Saca el registro de la entidad para el membrete.
 *
 * Recibe una forma estructural y no el tipo `Entidad` a propósito: si este
 * módulo importara de `ong.ts` quedaría atado al cliente de Supabase, y hoy
 * `pdfDocumento` no toca la red ni la base. Se puede probar sin mockear nada.
 */
export function registroDeEntidad(e: {
  cuit?: string | null
  organismo_control?: string | null
  sede_domicilio?: string | null
  sede_localidad?: string | null
  sede_provincia?: string | null
  fecha_constitucion?: string | null
  reprocann_inscripcion?: string | null
} | null | undefined): RegistroMembrete | undefined {
  if (!e) return undefined
  // La sede se arma con lo que haya: una asociación puede tener cargada la
  // localidad y todavía no la calle.
  const sede = [e.sede_domicilio, e.sede_localidad, e.sede_provincia]
    .map(x => (x ?? '').trim()).filter(Boolean).join(', ')
  return {
    cuit: e.cuit,
    organismoControl: e.organismo_control,
    sede: sede || null,
    constitucion: fechaCorta(e.fecha_constitucion),
    reprocannInscripcion: fechaCorta(e.reprocann_inscripcion),
  }
}

/** `2026-02-11` -> `11/02/2026`. Lo que no tenga esa forma se devuelve igual. */
function fechaCorta(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/**
 * Los renglones del bloque registral, en orden.
 *
 * Vive acá y no en cada lado que dibuja un membrete porque el PDF y la vista
 * de impresión tienen que decir LO MISMO. El comentario de arriba de este
 * módulo lo pide explícitamente: lo que se archiva y lo que se firma en papel
 * tienen que ser reconocibles como el mismo papel, y si difieren hay que
 * explicar por qué en una inspección. Con la lista armada en dos lados, la
 * próxima vez que se agregue un dato se agrega en uno solo.
 *
 * Cada renglón se arma con lo que haya —una asociación puede tener el organismo
 * cargado y todavía no la fecha— y el que queda vacío no sale en la lista.
 */
export function renglonesDelRegistro(r: RegistroMembrete | undefined): string[] {
  if (!r) return []
  const juntar = (...partes: (string | null | undefined)[]) =>
    partes.map(x => (x ?? '').trim()).filter(Boolean).join(' - ')
  return [
    juntar(r.sede, r.constitucion ? `Constituida el ${r.constitucion}` : null),
    juntar(r.organismoControl,
      r.reprocannInscripcion ? `REPROCANN ${r.reprocannInscripcion}` : null),
  ].filter(Boolean)
}

/**
 * Arma el PDF de un documento emitido.
 *
 * `pdf-lib` entra por import dinámico: pesa ~400KB y sólo hace falta en el
 * momento de emitir. Cargarlo con la app haría más lenta la pantalla de inicio
 * para todos por algo que se usa unas pocas veces al día.
 */
/**
 * Trae el emblema como bytes para meterlo en el PDF.
 *
 * Devuelve null y NO tira si el archivo no está: cada instalación pone el suyo
 * en `public/`, y la de Chaco todavía no lo tiene. Un membrete sin logo sigue
 * siendo un documento válido —lleva el nombre, el CUIT, la fecha y el filete—;
 * un PDF que no se puede emitir porque falta una imagen, no.
 *
 * `pdf-lib` sólo sabe PNG y JPG, así que el archivo tiene que ser uno de esos.
 */
async function bytesDelEmblema(): Promise<Uint8Array | null> {
  try {
    const r = await fetch(EMBLEMA)
    // Un `public/` que no tiene el archivo puede devolver el index.html con 200
    // en vez de un 404, y eso reventaría el `embedPng` con un error críptico.
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('image')) return null
    return new Uint8Array(await r.arrayBuffer())
  } catch { return null }
}

export async function pdfDelDocumento({
  titulo, texto, entidadNombre, emitido, registro,
}: {
  titulo: string
  texto: string
  entidadNombre: string | null
  /** La fecha que va impresa. Se pasa desde afuera para que el archivo y la ficha digan lo mismo. */
  emitido: string
  /**
   * Datos registrales, si la pantalla los tiene a mano.
   *
   * Es OPCIONAL porque no todas las pantallas que emiten un papel tienen la
   * entidad cargada, y un recibo sin el bloque registral sigue siendo un
   * recibo válido. Lo que NO se hace es imprimir el rótulo con una raya al
   * lado: un «CUIT —» sobre un documento que se presenta ante un organismo
   * dice que la asociación no lo tiene, y lo que en realidad pasó es que la
   * pantalla no lo pasó. Lo que falta se omite, y quien avisa que falta es
   * Coherencia, que para eso está.
   */
  registro?: RegistroMembrete
}): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const pdf = await PDFDocument.create()
  const serif = await pdf.embedFont(StandardFonts.TimesRoman)
  const sans = await pdf.embedFont(StandardFonts.Helvetica)
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // El emblema, igual que en la hoja impresa.
  //
  // El PDF salía sin logo y la impresión con logo, sobre un formato que este
  // mismo archivo declara que tiene que ser el MISMO papel: «si no, en una
  // inspección hay que explicar por qué difieren». Eran dos papeles distintos.
  const bytesLogo = await bytesDelEmblema()
  const logo = bytesLogo ? await pdf.embedPng(bytesLogo).catch(() => null) : null
  const logoAncho = logo ? (logo.width / logo.height) * LOGO_ALTO : 0
  /** Todo el bloque de la izquierda se corre para dejarle lugar al emblema. */
  const xTexto = M_LAT + (logo ? logoAncho + LOGO_AIRE : 0)

  const util = ANCHO - M_LAT * 2
  const nombre = aWinAnsi(entidadNombre || 'GrowFlow')
  const tit = aWinAnsi(titulo)
  const cuerpo = renglones(aWinAnsi(texto), t => serif.widthOfTextAtSize(t, CUERPO), util)

  const paginas: import('pdf-lib').PDFPage[] = []

  /** Abre una hoja nueva con membrete y devuelve dónde sigue el texto. */
  const nuevaHoja = (primera: boolean): number => {
    const p = pdf.addPage([ANCHO, ALTO])
    paginas.push(p)
    let y = ALTO - M_SUP

    if (logo) {
      p.drawImage(logo, {
        x: M_LAT, y: y - LOGO_ALTO + 2, width: logoAncho, height: LOGO_ALTO,
      })
    }
    p.drawText(nombre, {
      x: xTexto, y: y - 11, size: 13, font: sansBold,
      color: rgb(VERDE_OSCURO.r, VERDE_OSCURO.g, VERDE_OSCURO.b),
    })
    p.drawText('TRAZABILIDAD Y VIDA INSTITUCIONAL', {
      x: xTexto, y: y - 23, size: 7, font: sans, color: rgb(GRIS.r, GRIS.g, GRIS.b),
    })
    const pie = `Emitido ${emitido}`
    p.drawText(pie, {
      x: ANCHO - M_LAT - sans.widthOfTextAtSize(pie, 8.5), y: y - 11,
      size: 8.5, font: sans, color: rgb(GRIS.r, GRIS.g, GRIS.b),
    })
    // El CUIT va arriba del filete, alineado con el nombre: es el dato que
    // identifica a la persona jurídica, y en la columna derecha queda al lado
    // de la fecha, que es donde se lo busca en un papel.
    const cuit = registro?.cuit ? aWinAnsi(`CUIT ${registro.cuit}`) : null
    if (cuit) {
      p.drawText(cuit, {
        x: ANCHO - M_LAT - sans.widthOfTextAtSize(cuit, 7.5), y: y - 23,
        size: 7.5, font: sans, color: rgb(GRIS.r, GRIS.g, GRIS.b),
      })
    }
    // El filete verde: lo único de la marca que sobrevive a una fotocopia en
    // blanco y negro sin volverse una mancha.
    p.drawRectangle({
      x: M_LAT, y: y - 32, width: util, height: 2.5,
      color: rgb(VERDE.r, VERDE.g, VERDE.b),
    })
    y -= 50

    // Bloque registral, debajo del filete y en cuerpo chico: se lee cuando se
    // lo busca y no le compite al título. Los renglones los arma
    // `renglonesDelRegistro`, que es el mismo que usa la vista de impresión.
    const registrales = renglonesDelRegistro(registro)

    for (const linea of registrales) {
      // Se corta al ancho útil: el nombre del organismo de control es largo
      // —«Inspección General de Personas Jurídicas y Registro Público de
      // Comercio del Chaco»— y sin esto se sale de la hoja sin avisar.
      for (const l of renglones(aWinAnsi(linea), t => sans.widthOfTextAtSize(t, 7), util)) {
        p.drawText(l, { x: M_LAT, y, size: 7, font: sans, color: rgb(GRIS.r, GRIS.g, GRIS.b) })
        y -= 9.5
      }
    }
    // El aire entre el registro y el título. Con menos, los dos bloques se leen
    // como uno solo y el título deja de abrir el documento.
    if (registrales.length) y -= 20

    if (primera) {
      for (const l of renglones(tit.toUpperCase(), t => sansBold.widthOfTextAtSize(t, 12.5), util)) {
        p.drawText(l, {
          x: M_LAT, y, size: 12.5, font: sansBold,
          color: rgb(VERDE_OSCURO.r, VERDE_OSCURO.g, VERDE_OSCURO.b),
        })
        y -= 17
      }
      y -= 8
    }
    return y
  }

  let y = nuevaHoja(true)
  for (const linea of cuerpo) {
    if (y < M_INF) y = nuevaHoja(false)
    if (linea) {
      paginas[paginas.length - 1].drawText(linea, {
        x: M_LAT, y, size: CUERPO, font: serif, color: rgb(0.067, 0.067, 0.067),
      })
    }
    y -= INTERLINEA
  }

  // El pie va al final y no al abrir cada hoja: recién acá se sabe cuántas son.
  // «Hoja 2 de 5» en un documento que se puede separar es lo que permite ver
  // que no falta ninguna.
  paginas.forEach((p, i) => {
    const izq = nombre
    const der = `Hoja ${i + 1} de ${paginas.length}`
    p.drawRectangle({
      x: M_LAT, y: M_INF - 14, width: util, height: 0.7,
      color: rgb(0.906, 0.898, 0.894),
    })
    p.drawText(izq, { x: M_LAT, y: M_INF - 26, size: 7.5, font: sans, color: rgb(GRIS.r, GRIS.g, GRIS.b) })
    p.drawText(der, {
      x: ANCHO - M_LAT - sans.widthOfTextAtSize(der, 7.5), y: M_INF - 26,
      size: 7.5, font: sans, color: rgb(GRIS.r, GRIS.g, GRIS.b),
    })
  })

  return new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' })
}

/** Nombre de archivo estable y sin sorpresas para el sistema de archivos. */
export function nombreDePdf(titulo: string, emitido: string): string {
  const base = aWinAnsi(titulo)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]+/g, '')
    .trim().replace(/\s+/g, '-').toLowerCase()
    // Los separadores se juntan: «Acta N° 3 · para el libro» pasa por aWinAnsi,
    // el punto medio se vuelve guion, y sin esto queda «acta-n-3---para».
    .replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60).replace(/-$/, '') || 'documento'
  return `${base}-${emitido}.pdf`
}
