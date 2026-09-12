// Traduce el "dónde está" de una receta del manual a la ruta de la app.
//
// El manual escribe los destinos como texto legible entre backticks —
// `Cultivo › Sala`, `O.N.G. › Autodispensación › Reservas`— y el renderer los
// convierte en links usando esta tabla. La alternativa era escribir 31 links a
// mano en el markdown: se leen peor y hay que mantenerlos uno por uno.
//
// Las pestañas internas (las de O.N.G. o Econometría) no tienen ruta propia, así
// que el link deja al lector en la pantalla y desde ahí elige la pestaña. Llevarlo
// al lugar aproximado es mejor que no llevarlo.

/** Prefijo del destino → ruta. El orden importa: gana el primero que matchea. */
const RUTAS: [string, string][] = [
  ['Cultivo › Plantas', '/plantas'],
  ['Cultivo › Genéticas', '/geneticas'],
  ['Cultivo › Línea de tiempo', '/linea-tiempo'],
  ['Cultivo › Sala', '/sala'],
  ['Econometría', '/econometria'],
  ['O.N.G.', '/ong'],
  ['menú › Cosecha', '/cosecha'],
  ['menú › Ambiente', '/ambiente'],
  ['menú › Estadísticas', '/stats'],
  ['Tablas', '/tablas'],
]

/**
 * La ruta a la que apunta un destino del manual, o null si ese texto no nombra
 * una pantalla. Null es lo normal: la mayoría del código del manual son nombres
 * de campo, no destinos.
 */
export function rutaDe(texto: string): string | null {
  const t = texto.trim()
  for (const [prefijo, ruta] of RUTAS) {
    if (t === prefijo || t.startsWith(prefijo + ' ›')) return ruta
  }
  return null
}
