// Las cuentas de la asociación: la plata, la gente y las entregas.
//
// Acá no se dibuja nada. Son funciones puras sobre lo que ya está en la base,
// para que se puedan probar sin montar la pantalla.
//
// TRES CRITERIOS QUE VALEN PARA TODO EL ARCHIVO
//
// 1. Un mes sin movimientos EXISTE y vale cero. Si se arma la serie sólo con
//    los meses que aparecen en los datos, un mes parado se saltea y el gráfico
//    miente: dos barras contiguas que en realidad están separadas por un hueco.
//
// 2. El concepto se agrupa SIN acentos y sin distinguir mayúsculas. En la base
//    conviven «Retribucion» (171 asientos) y «Retribución» (14): es el mismo
//    gasto escrito de dos maneras, y sumarlos por separado parte el total en
//    dos pedazos que ninguno de los dos dice la verdad.
//
// 3. Cero calculado no es cero medido. Cuando no hay con qué dividir se
//    devuelve `null` y la pantalla muestra «—», que es distinto de «$0».

import { sinAcentos, type AsientoCaja, type Dispensa, type Asociado } from './ong'
import type { Paciente } from './registro'

/** La clave de mes que ordena alfabéticamente: '2026-08'. */
export const mesDe = (fecha: string) => fecha.slice(0, 7)

/** Suma cuidando los nulos, que en `aporte` y `monto` aparecen seguido. */
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0)

/** Divide sólo si tiene sentido: sin denominador no hay cero, hay «no sé». */
export const dividir = (a: number, b: number): number | null => (b > 0 ? a / b : null)

export interface MesOng {
  clave: string
  /** Lo que entró en el mes. */
  ingresos: number
  /** Lo que salió. */
  egresos: number
  /** ingresos - egresos: lo que el mes dejó o se comió. */
  resultado: number
  /** La suma de todos los resultados hasta este mes. */
  saldo: number
  entregas: number
  gramos: number
  aporte: number
  /** Personas distintas que retiraron ese mes. */
  personas: number
  /** Personas que se sumaron ese mes. */
  altas: number
  /** Personas vinculadas acumuladas al cierre del mes. */
  acumuladas: number
}

/** Todos los meses entre el primero y el último, sin huecos. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  let [a, m] = desde.split('-').map(Number)
  const [af, mf] = hasta.split('-').map(Number)
  // Tope de seguridad: una fecha rota en la base (un año 1900, un 9999) haría
  // un bucle de miles de vueltas y colgaría la pantalla sin decir por qué.
  for (let i = 0; i < 600 && (a < af || (a === af && m <= mf)); i++) {
    out.push(`${a}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; a++ }
  }
  return out
}

export function serieMensual(
  caja: AsientoCaja[],
  dispensas: Dispensa[],
  personas: { fecha_alta?: string | null }[],
): MesOng[] {
  const fechas = [
    ...caja.map(c => c.fecha),
    ...dispensas.map(d => d.fecha),
    ...personas.map(p => p.fecha_alta).filter((f): f is string => !!f),
  ].filter(f => typeof f === 'string' && f.length >= 7).sort()
  if (!fechas.length) return []

  const claves = mesesEntre(mesDe(fechas[0]), mesDe(fechas[fechas.length - 1]))
  const base = new Map<string, MesOng>(claves.map(clave => [clave, {
    clave, ingresos: 0, egresos: 0, resultado: 0, saldo: 0,
    entregas: 0, gramos: 0, aporte: 0, personas: 0, altas: 0, acumuladas: 0,
  }]))
  // Las personas distintas por mes se cuentan aparte: un Set por mes, porque
  // la misma persona puede retirar cinco veces y tiene que contar una.
  const quienes = new Map<string, Set<string>>(claves.map(c => [c, new Set()]))

  for (const c of caja) {
    const m = base.get(mesDe(c.fecha)); if (!m) continue
    if (c.tipo === 'ingreso') m.ingresos += num(c.monto); else m.egresos += num(c.monto)
  }
  for (const d of dispensas) {
    const m = base.get(mesDe(d.fecha)); if (!m) continue
    m.entregas++
    m.gramos += num(d.gramos)
    m.aporte += num(d.aporte)
    if (d.paciente_id) quienes.get(m.clave)!.add(d.paciente_id)
  }
  for (const p of personas) {
    if (!p.fecha_alta) continue
    const m = base.get(mesDe(p.fecha_alta)); if (!m) continue
    m.altas++
  }

  let saldo = 0, acum = 0
  return claves.map(clave => {
    const m = base.get(clave)!
    m.resultado = m.ingresos - m.egresos
    saldo += m.resultado
    acum += m.altas
    return { ...m, saldo, acumuladas: acum, personas: quienes.get(clave)!.size }
  })
}

/** La clave con la que dos grafías del mismo concepto caen en el mismo grupo. */
export const claveConcepto = (t: string) =>
  sinAcentos(t ?? '').toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim()

export interface Rubro {
  etiqueta: string
  total: number
  n: number
  /** Sobre el total del tipo, para la barra. */
  parte: number
}

/**
 * Junta los conceptos en rubros que se puedan leer de un vistazo.
 *
 * Sin esto la lista de egresos son 329 conceptos distintos, porque cada asiento
 * de una entrega lleva el código de la persona adentro del texto («Dispensa a
 * PAC-XXX»). Agrupados por su forma, esos 329 se vuelven una docena de rubros
 * que sí dicen algo: cuánto se fue en retribuciones, cuánto en alquiler.
 */
export function porRubro(caja: AsientoCaja[], tipo: 'ingreso' | 'egreso'): Rubro[] {
  const de = caja.filter(c => c.tipo === tipo)
  const total = de.reduce((s, c) => s + num(c.monto), 0)

  const grupos = new Map<string, { etiqueta: string; total: number; n: number; grafias: Map<string, number> }>()
  for (const c of de) {
    const etiqueta = rubroDe(c.concepto ?? '')
    const k = claveConcepto(etiqueta)
    const g = grupos.get(k) ?? { etiqueta, total: 0, n: 0, grafias: new Map() }
    g.total += num(c.monto)
    g.n++
    g.grafias.set(etiqueta, (g.grafias.get(etiqueta) ?? 0) + 1)
    grupos.set(k, g)
  }

  return [...grupos.values()]
    .map(g => ({
      // De las grafías del grupo se muestra la que más se usó: es la que la
      // gente reconoce, y elegir la primera que apareció sería arbitrario.
      etiqueta: [...g.grafias.entries()].sort((a, b) => b[1] - a[1])[0][0],
      total: g.total,
      n: g.n,
      parte: total > 0 ? g.total / total : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

/** «Dispensa a PAC-XXX» y «Pago a Georgina» son dos rubros, no 90 conceptos. */
export function rubroDe(concepto: string): string {
  const t = (concepto ?? '').trim()
  if (/^dispensa a /i.test(t)) return 'Entregas a personas'
  if (/^pago a /i.test(t)) return 'Pagos a cultivo'
  if (/^cuota/i.test(t)) return 'Cuotas sociales'
  return t || 'Sin concepto'
}


export interface Reparto { etiqueta: string; n: number; parte: number }

/** Cuenta por un campo y devuelve la parte que se lleva cada valor. */
export function repartoPor<T>(filas: T[], campo: (f: T) => string | null | undefined): Reparto[] {
  const c = new Map<string, number>()
  for (const f of filas) {
    const v = (campo(f) ?? '').trim() || 'Sin especificar'
    c.set(v, (c.get(v) ?? 0) + 1)
  }
  const total = filas.length
  return [...c.entries()]
    .map(([etiqueta, n]) => ({ etiqueta, n, parte: total > 0 ? n / total : 0 }))
    .sort((a, b) => b.n - a.n)
}

export interface Concentracion {
  /** Personas ordenadas de mayor a menor aporte, con su acumulado. */
  curva: { i: number; parteAcum: number }[]
  /** Qué parte del aporte explican las 10 personas que más aportan. */
  parteTop10: number | null
  personas: number
}

/**
 * Cuánto depende la asociación de unas pocas personas.
 *
 * Si diez personas explican la mitad del ingreso, que dos se vayan es un
 * problema de caja, no una baja más. Es el dato que no se ve en ningún
 * promedio.
 */
export function concentracion(dispensas: Dispensa[]): Concentracion {
  const porPersona = new Map<string, number>()
  for (const d of dispensas) {
    if (!d.paciente_id) continue
    porPersona.set(d.paciente_id, (porPersona.get(d.paciente_id) ?? 0) + num(d.aporte))
  }
  const montos = [...porPersona.values()].filter(v => v > 0).sort((a, b) => b - a)
  const total = montos.reduce((s, v) => s + v, 0)
  if (!montos.length || total <= 0) return { curva: [], parteTop10: null, personas: 0 }

  let acum = 0
  const curva = montos.map((v, i) => {
    acum += v
    return { i: i + 1, parteAcum: acum / total }
  })
  const top10 = montos.slice(0, 10).reduce((s, v) => s + v, 0)
  return { curva, parteTop10: top10 / total, personas: montos.length }
}

/** Lunes a domingo: en qué días se mueve la asociación. */
export function porDiaDeSemana(dispensas: Dispensa[]): { dia: string; n: number }[] {
  const NOMBRES = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
  const cuenta = new Array(7).fill(0)
  for (const d of dispensas) {
    // Mediodía y no medianoche: `new Date('2026-08-02')` se lee como UTC y en
    // Argentina (UTC-3) retrocede al día anterior, corriendo todo un día.
    const f = new Date(d.fecha + 'T12:00:00')
    if (isNaN(f.getTime())) continue
    cuenta[(f.getDay() + 6) % 7]++     // getDay() arranca en domingo
  }
  return NOMBRES.map((dia, i) => ({ dia, n: cuenta[i] }))
}

export interface ResumenPersonas {
  vinculadas: number
  activas: number
  socios: number
  reprocannVigente: number
  reprocannSinRegistro: number
  /** Vence dentro de los próximos 60 días: hay tiempo de renovarlo. */
  reprocannPorVencer: number
  reprocannVencido: number
}

export function resumenPersonas(pacientes: Paciente[], hoyISO: string): ResumenPersonas {
  const hoy = new Date(hoyISO + 'T12:00:00')
  const limite = new Date(hoy); limite.setDate(limite.getDate() + 60)
  let vigente = 0, sin = 0, porVencer = 0, vencido = 0
  for (const p of pacientes) {
    const v = p.reprocann_vencimiento ? new Date(p.reprocann_vencimiento + 'T12:00:00') : null
    if (v && !isNaN(v.getTime()) && v < hoy) { vencido++; continue }
    if (p.reprocann_estado === 'Vigente') {
      vigente++
      if (v && !isNaN(v.getTime()) && v <= limite) porVencer++
    } else sin++
  }
  return {
    vinculadas: pacientes.length,
    activas: pacientes.filter(p => p.activo !== false).length,
    socios: pacientes.filter(p => p.socio).length,
    reprocannVigente: vigente,
    reprocannSinRegistro: sin,
    reprocannPorVencer: porVencer,
    reprocannVencido: vencido,
  }
}

/** Lo entregado por producto, de mayor a menor. */
export function topProductos(dispensas: Dispensa[], tope = 10) {
  const m = new Map<string, { gramos: number; n: number }>()
  for (const d of dispensas) {
    const k = (d.producto ?? '').trim() || 'Sin especificar'
    const v = m.get(k) ?? { gramos: 0, n: 0 }
    v.gramos += num(d.gramos); v.n++
    m.set(k, v)
  }
  return [...m.entries()]
    .map(([producto, v]) => ({ producto, ...v }))
    .sort((a, b) => b.gramos - a.gramos)
    .slice(0, tope)
}

export interface Comparado { valor: number; anterior: number; variacion: number | null }

/** Un número contra el mismo número del período anterior. */
export function comparar(valor: number, anterior: number): Comparado {
  return { valor, anterior, variacion: anterior > 0 ? (valor - anterior) / anterior : null }
}

/** El acumulado de los últimos `n` meses de la serie. */
export function ultimos(serie: MesOng[], n: number) {
  const t = serie.slice(-n)
  const suma = (f: (m: MesOng) => number) => t.reduce((s, m) => s + f(m), 0)
  return {
    meses: t.length,
    ingresos: suma(m => m.ingresos),
    egresos: suma(m => m.egresos),
    resultado: suma(m => m.resultado),
    gramos: suma(m => m.gramos),
    entregas: suma(m => m.entregas),
    aporte: suma(m => m.aporte),
    altas: suma(m => m.altas),
  }
}

/** Personas que retiraron en los últimos 90 días y antes también: las que vuelven. */
export function personasQueVuelven(dispensas: Dispensa[], hoyISO: string) {
  const hoy = new Date(hoyISO + 'T12:00:00')
  const corte = new Date(hoy); corte.setDate(corte.getDate() - 90)
  const recientes = new Set<string>(), antes = new Set<string>()
  for (const d of dispensas) {
    if (!d.paciente_id) continue
    const f = new Date(d.fecha + 'T12:00:00')
    if (isNaN(f.getTime())) continue
    if (f >= corte) recientes.add(d.paciente_id); else antes.add(d.paciente_id)
  }
  const vuelven = [...recientes].filter(id => antes.has(id)).length
  return {
    recientes: recientes.size,
    nuevas: recientes.size - vuelven,
    vuelven,
    parte: recientes.size > 0 ? vuelven / recientes.size : null,
  }
}

/** Asociados con el mandato firmado: lo que sostiene que la entrega no es venta. */
export function mandatosFirmados(asociados: Asociado[]) {
  const con = asociados.filter(a => a.mandato_aceptado).length
  return { con, sin: asociados.length - con, total: asociados.length }
}
