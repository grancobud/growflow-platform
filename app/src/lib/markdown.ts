// Parser de Markdown acotado al subset que usa el manual.
//
// No es un parser general y no pretende serlo: cubre encabezados, párrafos,
// listas, tablas, citas, separadores y el formato inline (negrita, cursiva,
// código, links). Traer una librería entera para renderizar un documento propio
// sería sumar decenas de kB al bundle para leer un archivo que escribimos nosotros.
//
// El markdown es la fuente: se edita app/src/contenido/manual.md y la pantalla
// se actualiza sola. Tener el texto duplicado en JSX garantizaba que un día las
// dos copias dijeran cosas distintas.

export type Bloque =
  | { tipo: 'titulo'; nivel: 1 | 2 | 3; texto: string; id: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; ordenada: boolean; items: string[] }
  | { tipo: 'tabla'; encabezados: string[]; filas: string[][] }
  | { tipo: 'cita'; texto: string }
  | { tipo: 'separador' }

// Se listan los acentos a mano en vez de normalizar con NFD: el rango de
// diacríticos combinantes es invisible en el fuente, y cualquier editor o script
// que reescriba el archivo con otro encoding lo rompe sin que se note.
const SIN_TILDE: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n', ç: 'c',
}

/** Ancla estable para el índice: sin tildes, sin símbolos, con guiones. */
export function anclaDe(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[áéíóúüñç]/g, ch => SIN_TILDE[ch] ?? '')
    // Lo que quede fuera del alfabeto ASCII se descarta: los separadores del
    // manual (un punto medio, una raya) no aportan nada a un ancla.
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

const celdas = (linea: string): string[] =>
  linea.replace(/^\||\|$/g, '').split('|').map(c => c.trim())

const esSeparadorTabla = (l: string) =>
  /^\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes('-')

export function parsearMarkdown(md: string): Bloque[] {
  const lineas = md.replace(/\r\n/g, '\n').split('\n')
  const bloques: Bloque[] = []
  let i = 0

  const parrafoPendiente: string[] = []
  const cerrarParrafo = () => {
    if (!parrafoPendiente.length) return
    bloques.push({ tipo: 'parrafo', texto: parrafoPendiente.join(' ').trim() })
    parrafoPendiente.length = 0
  }

  while (i < lineas.length) {
    const linea = lineas[i]
    const limpia = linea.trim()

    if (!limpia) { cerrarParrafo(); i++; continue }

    // El separador se chequea antes que la tabla: `---` también matchea ahí.
    if (/^-{3,}$/.test(limpia)) {
      cerrarParrafo()
      bloques.push({ tipo: 'separador' })
      i++; continue
    }

    const enc = /^(#{1,3})\s+(.*)$/.exec(limpia)
    if (enc) {
      cerrarParrafo()
      const texto = enc[2].trim()
      bloques.push({ tipo: 'titulo', nivel: enc[1].length as 1 | 2 | 3, texto, id: anclaDe(texto) })
      i++; continue
    }

    // Tabla: fila de encabezado seguida de la línea de guiones.
    if (limpia.startsWith('|') && esSeparadorTabla((lineas[i + 1] ?? '').trim())) {
      cerrarParrafo()
      const encabezados = celdas(limpia)
      i += 2
      const filas: string[][] = []
      while (i < lineas.length && lineas[i].trim().startsWith('|')) {
        filas.push(celdas(lineas[i].trim()))
        i++
      }
      bloques.push({ tipo: 'tabla', encabezados, filas })
      continue
    }

    if (limpia.startsWith('>')) {
      cerrarParrafo()
      const partes: string[] = []
      while (i < lineas.length && lineas[i].trim().startsWith('>')) {
        partes.push(lineas[i].trim().replace(/^>\s?/, ''))
        i++
      }
      bloques.push({ tipo: 'cita', texto: partes.join(' ').trim() })
      continue
    }

    const item = /^(\d+\.|[-*])\s+(.*)$/.exec(limpia)
    if (item) {
      cerrarParrafo()
      const ordenada = /^\d+\./.test(item[1])
      const items: string[] = []
      while (i < lineas.length) {
        const l = lineas[i]
        const m = /^(\d+\.|[-*])\s+(.*)$/.exec(l.trim())
        if (m && /^\d+\./.test(m[1]) === ordenada) {
          items.push(m[2].trim())
          i++; continue
        }
        // Línea indentada sin marcador: es continuación del item anterior. Sin
        // esto, los items de varias líneas del manual se partían en pedazos.
        if (l.startsWith('  ') && l.trim() && items.length) {
          items[items.length - 1] += ' ' + l.trim()
          i++; continue
        }
        break
      }
      bloques.push({ tipo: 'lista', ordenada, items })
      continue
    }

    parrafoPendiente.push(limpia)
    i++
  }

  cerrarParrafo()
  return bloques
}

export type Trozo =
  | { t: 'texto'; v: string }
  | { t: 'negrita'; v: string }
  | { t: 'cursiva'; v: string }
  | { t: 'codigo'; v: string }
  | { t: 'link'; v: string; href: string }

/**
 * Formato inline. El código se resuelve primero y su contenido no se vuelve a
 * mirar: adentro de `código` un asterisco es un asterisco, no una cursiva.
 */
export function parsearInline(texto: string): Trozo[] {
  const trozos: Trozo[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g
  let ultimo = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) trozos.push({ t: 'texto', v: texto.slice(ultimo, m.index) })
    if (m[1] != null) trozos.push({ t: 'codigo', v: m[1] })
    else if (m[2] != null) trozos.push({ t: 'negrita', v: m[2] })
    else if (m[3] != null) trozos.push({ t: 'cursiva', v: m[3] })
    else if (m[4] != null) trozos.push({ t: 'link', v: m[4], href: m[5] })
    ultimo = m.index + m[0].length
  }
  if (ultimo < texto.length) trozos.push({ t: 'texto', v: texto.slice(ultimo) })
  return trozos
}
