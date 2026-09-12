// Redacción del acta para pasarla al libro.
//
// Los libros de una asociación civil son FÍSICOS y rubricados: el acta se
// transcribe a mano o se imprime y se pega. Esta es la parte que la app no
// cubría: se cargaban los datos y después había que redactar el texto aparte.
//
// El formato sigue el uso habitual de las actas de asociación civil, que es lo
// que esperan IGJ y DPPJ al inspeccionar:
//
//   1. Encabezado con número de acta, lugar, fecha y hora de apertura.
//   2. Constancia de asistencia con los nombres, y de quórum.
//   3. Designación de quién preside y quién labra el acta.
//   4. Orden del día punto por punto, con la resolución y las mayorías.
//   5. Hora de cierre y firmantes.
//
// No inventa nada: lo que no está cargado se marca entre corchetes para que se
// complete a mano. Un acta con un dato inventado es peor que una incompleta.

import { TIPOS_ACTA, type Acta, type Entidad } from './ong'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "13 de agosto de 2026" — las actas se fechan en letras, no en dígitos. */
export function fechaEnLetras(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return `${d} de ${MESES[m - 1]} de ${a}`
}

const FALTA = (q: string) => `[${q}]`

// ---------------------------------------------------------------------------
// Importes en letras
// ---------------------------------------------------------------------------

const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
  'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro',
  'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta',
  'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

/** 0..99. El "y" va sólo de treinta para arriba: es "veintidós", no "veinte y dos". */
function hasta99(n: number): string {
  if (n < 30) return UNIDADES[n]
  const d = Math.floor(n / 10), u = n % 10
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`
}

/** 1..999. Cien pelado es "cien"; con algo atrás es "ciento". */
function hasta999(n: number): string {
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100), r = n % 100
  return [c > 0 ? CENTENAS[c] : '', r > 0 ? hasta99(r) : ''].filter(Boolean).join(' ')
}

/** El apócope: "veintiún mil", no "veintiuno mil". Sólo aplica al uno final. */
function apocopar(s: string): string {
  return s.replace(/\bveintiuno$/, 'veintiún').replace(/\buno$/, 'un')
}

/**
 * El importe en letras, como lo lleva un recibo.
 *
 * Un recibo oficial escribe el importe en letras además de en números: es lo
 * que impide que a "$XXX.XXX" alguien le agregue un cero después de firmado.
 * El pack de plantillas lo pide (`{{monto_en_letras}}`) y era lo único de esa
 * plantilla que se podía resolver entero desde el código, sin ningún dato nuevo.
 *
 * Los centavos van en quebrado —"con 96/100"— que es la convención de los
 * recibos, no en letras. Si el importe es redondo no se escriben.
 *
 * Arriba de 999.999.999 devuelve los dígitos: preferible a redactar mal una
 * cifra que va en un documento firmado. Con los montos de la asociación (el máximo es
 * $X.XXX.XXX) no se llega ni cerca.
 */
export function pesosEnLetras(monto: number): string {
  if (!Number.isFinite(monto)) return FALTA('importe')
  const negativo = monto < 0
  const abs = Math.abs(monto)
  const entero = Math.floor(abs)
  const centavos = Math.round((abs - entero) * 100)
  if (entero > 999_999_999) return `${abs.toLocaleString('es-AR')} pesos`

  let texto: string
  if (entero === 0) {
    texto = 'cero'
  } else {
    const millones = Math.floor(entero / 1_000_000)
    const miles = Math.floor((entero % 1_000_000) / 1000)
    const resto = entero % 1000
    const partes: string[] = []
    if (millones === 1) partes.push('un millón')
    else if (millones > 1) partes.push(`${apocopar(hasta999(millones))} millones`)
    if (miles === 1) partes.push('mil')
    else if (miles > 1) partes.push(`${apocopar(hasta999(miles))} mil`)
    if (resto > 0) partes.push(hasta999(resto))
    texto = partes.join(' ')
  }

  // "un millón pesos" no se escribe: cuando la cifra termina justo en millón o
  // millones va "de pesos". Y el uno se apocopa y el peso va en singular.
  let unidad = 'pesos'
  if (/mill(ón|ones)$/.test(texto)) unidad = 'de pesos'
  else if (entero === 1) { texto = 'un'; unidad = 'peso' }

  const conCentavos = centavos > 0
    ? `${texto} ${unidad} con ${String(centavos).padStart(2, '0')}/100`
    : `${texto} ${unidad}`
  return negativo ? `menos ${conCentavos}` : conCentavos
}

/**
 * Los ids que usa la app contra el nombre que va en el acta. Se toma de
 * TIPOS_ACTA para que no puedan divergir: cuando estaban duplicados a mano, un
 * acta de Comisión Directiva salía redactada como "los miembros de la cd".
 */
function nombreDelOrgano(tipo: string): string {
  const t = TIPOS_ACTA.find(x => x.id === tipo)
  if (!t) return tipo.replace(/_/g, " ")
  // En el cuerpo del acta las asambleas se nombran completas.
  if (t.id === "asamblea_ordinaria") return "Asamblea General Ordinaria"
  if (t.id === "asamblea_extraordinaria") return "Asamblea General Extraordinaria"
  return t.nombre
}

/** Cómo se anuncia el resultado de un punto en el cuerpo del acta. */
function redactarResultado(p: NonNullable<Acta['orden_del_dia']>[number]): string {
  const votos = [
    p.favor != null ? `${p.favor} voto${p.favor === 1 ? '' : 's'} a favor` : null,
    p.contra ? `${p.contra} en contra` : null,
    p.abstenciones ? `${p.abstenciones} abstención${p.abstenciones === 1 ? '' : 'es'}` : null,
  ].filter(Boolean).join(', ')

  if (p.resultado === 'aprobado') {
    // Sin votos en contra ni abstenciones, la fórmula usual es "por unanimidad".
    const unanime = !p.contra && !p.abstenciones
    return votos
      ? `Se aprueba por ${unanime ? 'unanimidad' : 'mayoría'} (${votos}).`
      : `Se aprueba por ${unanime ? 'unanimidad' : 'mayoría'}.`
  }
  if (p.resultado === 'rechazado') return votos ? `Se rechaza (${votos}).` : 'Se rechaza.'
  return 'Queda pendiente de tratamiento.'
}

export function redactarActa(a: Acta, e: Entidad | null): string {
  const L: string[] = []
  const razon = e?.razon_social || FALTA('razón social')
  const lugar = a.lugar || e?.sede_domicilio || FALTA('lugar')
  const organo = nombreDelOrgano(a.tipo)
  const nombres = a.asistentes_nombres ?? []
  const total = nombres.length || a.asistentes || 0

  L.push(`ACTA N° ${a.numero}`)
  L.push('')
  L.push(
    `En ${lugar}, a los ${fechaEnLetras(a.fecha)}, siendo las ` +
    `${a.hora_inicio || FALTA('hora')} horas, se reúnen los miembros de la ` +
    `${organo} de ${razon}` +
    (a.segunda_convocatoria ? ', en segunda convocatoria' : '') + '.',
  )
  L.push('')

  // --- Asistencia y quórum ---
  if (nombres.length) {
    L.push(`ASISTENCIA. Se encuentran presentes: ${nombres.join(', ')}. ` +
      `Total: ${nombres.length} asistente${nombres.length === 1 ? '' : 's'}.`)
  } else if (a.asistentes) {
    L.push(`ASISTENCIA. Asisten ${a.asistentes} persona${a.asistentes === 1 ? '' : 's'}. ` +
      `${FALTA('completar los nombres: el libro de Asistencia los requiere')}`)
  } else {
    L.push(`ASISTENCIA. ${FALTA('completar quiénes asistieron')}`)
  }

  const req = a.quorum_requerido
  L.push(
    a.quorum_ok === false
      ? `Se hace constar que NO se alcanza el quórum requerido` +
        (req ? ` de ${req} miembros` : '') + `, por lo que no puede sesionarse válidamente.`
      : `Verificado el quórum` + (req ? ` (se requieren ${req}, hay ${total})` : '') +
        `, se declara abierta la sesión.`,
  )
  L.push('')

  // --- Presidencia y redacción ---
  const firmantes = (a.firmantes || '').split(/,| y /).map(f => f.trim()).filter(Boolean)
  L.push(firmantes.length >= 2
    ? `Preside la reunión ${firmantes[0]}, y labra la presente acta ${firmantes[1]}.`
    : `Preside la reunión ${firmantes[0] || FALTA('presidente')}, y labra la presente acta ` +
      `${FALTA('secretario')}.`)
  L.push('')

  // --- Orden del día ---
  const puntos = a.orden_del_dia ?? []
  if (puntos.length) {
    L.push('ORDEN DEL DÍA')
    L.push('')
    puntos.forEach((p, i) => {
      L.push(`${i + 1}) ${p.punto}`)
      L.push(`   ${redactarResultado(p)}`)
      L.push('')
    })
  } else {
    L.push(`ORDEN DEL DÍA. ${FALTA('cargar los puntos tratados')}`)
    L.push('')
  }

  // --- Cierre ---
  L.push(
    `No habiendo más asuntos que tratar, se da por finalizada la reunión siendo ` +
    `las ${a.hora_fin || FALTA('hora de cierre')} horas.`,
  )
  L.push('')
  if (firmantes.length) {
    L.push(...firmantes.map(f => `\n\n_______________________________\n${f}`))
  } else {
    L.push('\n\n_______________________________\nPresidente')
    L.push('\n\n_______________________________\nSecretario')
  }

  return L.join('\n')
}

/** Los datos que faltan para que el acta esté completa, en lenguaje llano. */
export function faltantesDelActa(a: Acta, e: Entidad | null): string[] {
  const f: string[] = []
  if (!a.lugar && !e?.sede_domicilio) f.push('el lugar de la reunión')
  if (!a.hora_inicio) f.push('la hora de apertura')
  if (!a.hora_fin) f.push('la hora de cierre')
  if (!(a.asistentes_nombres ?? []).length) f.push('los nombres de los asistentes')
  if (!(a.orden_del_dia ?? []).length) f.push('los puntos del orden del día')
  if (!a.firmantes) f.push('los firmantes')
  if (!a.libro_id) f.push('en qué libro se asienta')
  return f
}
