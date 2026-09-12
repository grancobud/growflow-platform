// CÓMO SE ARMA EL ÍNDICE DEL MANUAL, y por qué los grupos están acá y no a ojo.
//
// El manual numera sus capítulos en el texto —«00 · Cómo está organizado»,
// «07b · El circuito completo»—, así que el número se puede separar del título
// sin mantener una tabla paralela que se desincronice con el markdown.
//
// Los GRUPOS sí son una decisión editorial y por eso están escritos: no salen
// del número. Responden a para qué se entra al manual, que son cuatro momentos
// distintos y no un continuo.

import type { Bloque } from './markdown'

export interface Titulo {
  id: string
  /** «00a», «07b», «11». Vacío si el capítulo no viene numerado. */
  numero: string
  /** El título sin su número. */
  titulo: string
  nivel: 2 | 3
}

/**
 * Parte «00a · Abrir la sede: los cuatro pasos del Panel» en sus dos mitades.
 *
 * El separador es « · » con espacios, que es como está escrito en el markdown.
 * Sin espacios no se corta: hay títulos que usan «·» adentro para separar
 * datos, y partir por ahí dejaría el número lleno de texto.
 */
export function partirTitulo(texto: string): { numero: string; titulo: string } {
  const i = texto.indexOf(' · ')
  if (i < 0) return { numero: '', titulo: texto }
  const numero = texto.slice(0, i).trim()
  // Sólo se considera número lo que parece uno: dígitos con una letra opcional.
  // Si no, era un título con puntos medios adentro y se deja entero.
  if (!/^\d{1,2}[a-z]?$/i.test(numero)) return { numero: '', titulo: texto }
  return { numero, titulo: texto.slice(i + 3).trim() }
}

/** Los capítulos (h2) con las secciones (h3) que cuelgan de cada uno. */
export function seccionesDe(bloques: Bloque[]): { capitulo: Titulo; subs: Titulo[] }[] {
  const salida: { capitulo: Titulo; subs: Titulo[] }[] = []
  for (const b of bloques) {
    if (b.tipo !== 'titulo') continue
    if (b.nivel === 2) {
      salida.push({ capitulo: { id: b.id, nivel: 2, ...partirTitulo(b.texto) }, subs: [] })
    } else if (b.nivel === 3 && salida.length > 0) {
      salida[salida.length - 1].subs.push({ id: b.id, nivel: 3, ...partirTitulo(b.texto) })
    }
  }
  return salida
}

/**
 * A qué grupo va cada capítulo.
 *
 * ⚠️ ES UNA LISTA DE PREFIJOS, NO UN RANGO. Los capítulos no son correlativos
 * —hay `00a`, `00b`, `00c` y `07b`—, así que un `desde/hasta` numérico dejaría
 * a esos cuatro afuera sin que nada falle: caerían en el grupo del final.
 */
const GRUPOS: { nombre: string; pista: string; capitulos: string[] }[] = [
  { nombre: 'Para empezar', pista: 'Leelo una vez y ya podés operar',
    capitulos: ['00', '00a', '00b', '00c'] },
  { nombre: 'El día a día', pista: 'Lo que se hace todas las semanas',
    capitulos: ['01', '02', '03', '04', '05', '06'] },
  { nombre: 'Rendir cuentas', pista: 'Lo que mira un organismo',
    capitulos: ['07', '07b', '08', '09'] },
  { nombre: 'Cuando algo no cierra', pista: 'Para buscar, no para leer',
    capitulos: ['10', '11'] },
]

export function agruparCapitulos(secciones: { capitulo: Titulo; subs: Titulo[] }[]) {
  const usados = new Set<string>()
  const grupos = GRUPOS.map(g => ({
    nombre: g.nombre,
    pista: g.pista,
    secciones: g.capitulos
      .map(n => secciones.find(s => s.capitulo.numero === n))
      .filter((s): s is { capitulo: Titulo; subs: Titulo[] } => {
        if (!s) return false
        usados.add(s.capitulo.id)
        return true
      }),
  })).filter(g => g.secciones.length > 0)

  // ⚠️ LO QUE NO ENTRÓ EN NINGÚN GRUPO SE MUESTRA IGUAL, al final.
  //
  // Un capítulo nuevo en el markdown no aparece acá hasta que alguien lo
  // agregue a GRUPOS, y sin esta cola desaparecería del índice sin romper
  // nada: el capítulo estaría en la página y no habría cómo llegar. Es el
  // mismo error que un default silencioso.
  const sueltos = secciones.filter(s => !usados.has(s.capitulo.id))
  if (sueltos.length > 0) {
    grupos.push({ nombre: 'Además', pista: 'Todavía sin agrupar', secciones: sueltos })
  }
  return grupos
}
