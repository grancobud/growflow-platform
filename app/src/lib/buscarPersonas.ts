/**
 * BUSCAR UNA PERSONA EN UNA LISTA DE CIENTO CINCUENTA.
 *
 * El desplegable de pacientes era un `<select>` con el padrón entero: para
 * entregarle a alguien había que scrollear hasta encontrarlo. Con 151 activos
 * eso es scroll, y peor todavía porque los nombres NO están todos escritos con
 * el mismo criterio: hay «Juan Pablo Donnet» y hay «Aguirre Walter Ariel».
 *
 * Por eso el filtro compara CADA PALABRA de lo escrito contra CADA PALABRA del
 * nombre, en cualquier orden. Escribir «juan cruz» encuentra a «Juan cruz Díaz
 * Rokiteniec» y también encontraría a un «Díaz Juan Cruz»: quien busca no tiene
 * por qué saber en qué orden lo cargaron.
 *
 * EL APELLIDO VA PRIMERO, siempre y en todos lados. Para poder cumplirlo hubo
 * que separar el dato: `nombre_completo` es texto libre cargado con dos
 * criterios distintos, así que la app guarda `apellido` y `nombres` aparte.
 *
 * ⚠️ El apellido de las 151 fichas está DEDUCIDO (la última palabra), no
 * confirmado. Es la convención del formulario —«Nombre y Apellido»— y acierta
 * en la mayoría, pero se equivoca en los que están al revés. Por eso existe
 * `apellido_confirmado`: sin esa marca, un orden por apellido se leería como
 * un dato verificado cuando no lo es.
 */

/** Sin acentos, sin mayúsculas y sin espacios de más. */
export const normalizar = (s: string): string =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export interface PersonaBuscable {
  id: string
  nombre_completo: string
  codigo?: string | null
  dni?: string | null
}

/**
 * Las personas que coinciden con lo escrito.
 *
 * Coincide si TODAS las palabras de la consulta aparecen en algún lugar del
 * nombre, del código o del DNI. «Todas» y no «alguna»: escribir dos palabras es
 * pedir que la búsqueda se achique, y con `alguna` escribir más devolvería más,
 * que es lo contrario de lo que uno espera al seguir tecleando.
 *
 * Busca por PREFIJO de palabra, no por subcadena: «mar» encuentra a «Marcelo»
 * pero no a «Guzmán». Buscar dentro de la palabra trae ruido que no se entiende
 * —«ana» devolvería a Juana, Mariana y Santana— y quien busca a Ana no
 * reconoce esa lista como una respuesta a lo que preguntó.
 */
export function filtrarPersonas<T extends PersonaBuscable>(
  personas: T[], consulta: string,
): T[] {
  // La consulta se parte con el MISMO criterio que los campos: si no, escribir
  // «PAC-XXX» queda como una sola palabra y no matchea contra los tokens «pac»
  // y «024» en los que se partió el código.
  const palabras = normalizar(consulta).split(/[\s.-]+/).filter(Boolean)
  if (palabras.length === 0) return personas

  return personas.filter(p => {
    // El código y el DNI entran a la misma bolsa: quien tiene el PAC-XXX a mano
    // lo escribe, y quien tiene el DNI también. Es la misma búsqueda.
    const campos = normalizar(
      `${p.nombre_completo ?? ''} ${p.codigo ?? ''} ${p.dni ?? ''}`,
    )
    const tokens = campos.split(/[\s.-]+/).filter(Boolean)
    return palabras.every(q => tokens.some(t => t.startsWith(q)))
  })
}

/**
 * Cómo se ordena la lista. Alfabético y estable.
 *
 * `localeCompare` con 'es' para que la Ñ caiga después de la N y los acentos no
 * manden a nadie al final.
 */
export const ordenarPersonas = <T extends PersonaBuscable>(personas: T[]): T[] =>
  [...personas].sort((a, b) =>
    (a.nombre_completo ?? '').localeCompare(b.nombre_completo ?? '', 'es', { numeric: true }))

/**
 * Si dos personas de la lista comparten nombre.
 *
 * Cuando pasa hay que mostrar algo más —el código— o la lista ofrece dos
 * renglones idénticos y elegir es adivinar. En el padrón de la asociación pasó de
 * verdad: hubo tres «Rocio Galarza» al mismo tiempo.
 */
export function nombresRepetidos(personas: PersonaBuscable[]): Set<string> {
  const vistos = new Map<string, number>()
  for (const p of personas) {
    const k = normalizar(p.nombre_completo ?? '')
    vistos.set(k, (vistos.get(k) ?? 0) + 1)
  }
  return new Set([...vistos].filter(([, n]) => n > 1).map(([k]) => k))
}

/**
 * Cómo se escribe una persona en pantalla: APELLIDO primero.
 *
 * «Donnet, Juan Pablo». Es la convención de toda la app, no de una pantalla:
 * una lista donde algunos renglones empiezan por el nombre y otros por el
 * apellido no se puede recorrer con la vista.
 *
 * Si el apellido no está separado todavía, cae a `nombre_completo` tal cual.
 * Mostrar «, » con la mitad vacía sería peor que no reordenar.
 */
export function nombreParaMostrar(p: {
  nombre_completo?: string | null
  apellido?: string | null
  nombres?: string | null
}): string {
  const ape = (p.apellido ?? '').trim()
  const nom = (p.nombres ?? '').trim()
  if (!ape) return (p.nombre_completo ?? '').trim()
  return nom ? `${ape}, ${nom}` : ape
}

/**
 * El orden de la app: por apellido, y a igual apellido por nombre.
 *
 * Cae a `nombre_completo` para quien todavía no tenga el apellido separado, así
 * la lista nunca queda con un hueco al principio.
 */
export const ordenarPorApellido = <T extends PersonaBuscable & { apellido?: string | null; nombres?: string | null }>(
  personas: T[],
): T[] =>
  [...personas].sort((a, b) =>
    nombreParaMostrar(a).localeCompare(nombreParaMostrar(b), 'es', { numeric: true, sensitivity: 'base' }))

/**
 * A QUIÉN APUNTA UN QR LEÍDO. La otra mitad del carnet.
 *
 * El carnet lleva en el QR el CÓDIGO DEL SOCIO —`armarCarnet().qr` es
 * literalmente `paciente.codigo`— y acá se lo busca. Las dos puntas tienen que
 * hablar el mismo idioma o el QR es un adorno, que es exactamente lo que el
 * carnet no quería ser.
 *
 * Vivía adentro del componente del buscador. Está acá para poder probar el
 * viaje entero —carnet emitido → QR → ficha encontrada— en un test, que es la
 * única forma de verificarlo sin una cámara.
 *
 * TOLERANTE CON LO QUE ENTRA, ESTRICTA CON LO QUE DEVUELVE. Un lector de QR
 * entrega lo que ve: con espacios al borde, en minúsculas si así se imprimió, y
 * a veces la URL entera de la que el código es el final. Todo eso se limpia. Lo
 * que NO se hace es aflojar la comparación: se busca el código exacto, porque
 * devolver «el que más se parece» sería entregarle material a otra persona.
 */
export function buscarPorCodigo<T extends PersonaBuscable>(
  personas: T[], texto: string,
): T | null {
  // Si vino una URL, el código es el último tramo con contenido.
  const crudo = texto.trim()
  const cod = (crudo.includes('/') ? crudo.split('/').filter(Boolean).pop() ?? '' : crudo)
    .trim().toUpperCase()
  if (!cod) return null
  return personas.find(p => (p.codigo ?? '').trim().toUpperCase() === cod) ?? null
}
