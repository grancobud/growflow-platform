// La planilla de control, generada desde la app.
//
// La asociación viene de una planilla que nadie quiere seguir usando y pasa a
// cargar todo acá. Pero «todo en la app» no puede significar «y ahora no hay
// forma de mirarlo afuera»: para un control, una inspección o simplemente para
// revisar números con alguien que no tiene usuario, hace falta poder bajarlo.
//
// ⚠ La dirección importa y es de una sola mano: la app es la fuente y la
// planilla es una SALIDA. Nadie carga en la planilla y nadie la vuelve a subir.
// Es lo que evita que existan dos autoridades sobre el código de lote, que es de
// donde venían los duplicados.
//
// CSV y no .xlsx: abre en Excel igual y no suma una dependencia de cientos de kB
// por una pantalla. Es el mismo criterio con el que los gráficos son SVG a mano.

/** Una celda: lo que se sabe escribir sin inventar formato. */
export type Celda = string | number | null | undefined

/**
 * Una celda, escapada como manda el CSV.
 *
 * Se citan las celdas con coma, comillas o salto de línea, y las comillas de
 * adentro se duplican. Sin esto, un proveedor que se llama «Pinito, S.A.» parte
 * la fila en dos columnas y todo lo que sigue queda corrido.
 *
 * Los números van sin comillas y con punto decimal: entre comillas Excel los
 * lee como texto y no se pueden sumar, que es justamente para lo que se baja.
 */
export function celdaCsv(v: Celda): string {
  if (v == null) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  const s = String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Una tabla —encabezado y filas— a texto CSV. */
export function tablaCsv(encabezado: string[], filas: Celda[][]): string {
  // CRLF y no \n: es lo que espera Excel en Windows, que es donde esto se abre.
  return [encabezado, ...filas].map(f => f.map(celdaCsv).join(',')).join('\r\n')
}

/**
 * El texto de una hoja, con el BOM adelante.
 *
 * ⚠ El BOM no es decorativo: sin él Excel abre el archivo como ANSI y todo
 * acento se rompe —«Argüello» sale «ArgÃ¼ello»— en una planilla llena de
 * nombres de personas. Es el mismo detalle que el parser de `csv.ts` ya
 * contempla al LEER, acá del lado de escribir.
 */
export function hojaCsv(encabezado: string[], filas: Celda[][]): string {
  return '﻿' + tablaCsv(encabezado, filas)
}

/** Un nombre de archivo con la fecha adentro, para que no se pisen. */
export function nombreDeArchivo(hoja: string, hoy: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const fecha = `${hoy.getFullYear()}-${p(hoy.getMonth() + 1)}-${p(hoy.getDate())}`
  return `${hoja}-${fecha}.csv`
}

// --- Las tres hojas -------------------------------------------------------
//
// Lotes, Dispensas y Caja: lo que pide un control y lo que la planilla vieja
// cubría. El resto se suma cuando lo pidan, no antes.

export interface LotePlanilla {
  codigo?: string | null
  producto?: string | null
  gramos_totales?: number | null
  unidad?: string | null
  origen?: string | null
  proveedor?: string | null
  costo_por_gramo?: number | null
  aporte_por_gramo?: number | null
  fecha_elaboracion?: string | null
  thc_pct?: number | null
  cbd_pct?: number | null
  activo?: boolean | null
}

export function planillaLotes(lotes: LotePlanilla[]): string {
  return hojaCsv(
    ['Código', 'Producto', 'Cantidad', 'Unidad', 'Origen', 'Proveedor',
      'Costo por unidad', 'Aporte por unidad', 'Elaboración', 'THC %', 'CBD %', 'Activo'],
    lotes.map(l => [
      l.codigo, l.producto, l.gramos_totales, l.unidad ?? 'g',
      l.origen ?? 'comprado', l.proveedor,
      l.costo_por_gramo, l.aporte_por_gramo, l.fecha_elaboracion,
      l.thc_pct, l.cbd_pct, l.activo === false ? 'no' : 'sí',
    ]),
  )
}

export interface DispensaPlanilla {
  fecha?: string | null
  paciente_nombre?: string | null
  paciente_codigo?: string | null
  lote_codigo?: string | null
  gramos?: number | null
  unidad?: string | null
  aporte?: number | null
  medio_pago?: string | null
}

export function planillaDispensas(dispensas: DispensaPlanilla[]): string {
  return hojaCsv(
    ['Fecha', 'Paciente', 'Código paciente', 'Lote', 'Cantidad', 'Unidad', 'Aporte', 'Medio de pago'],
    dispensas.map(d => [
      d.fecha, d.paciente_nombre, d.paciente_codigo, d.lote_codigo,
      d.gramos, d.unidad ?? 'g', d.aporte, d.medio_pago,
    ]),
  )
}

export interface AsientoPlanilla {
  fecha?: string | null
  tipo?: string | null
  concepto?: string | null
  categoria?: string | null
  beneficiario?: string | null
  monto?: number | null
  medio_pago?: string | null
}

/**
 * Baja un CSV al disco.
 *
 * Mismo mecanismo que el export OpenTHC: blob, un `<a>` que se clickea solo, y
 * la URL se libera enseguida. `charset=utf-8` acompaña al BOM; los dos hacen
 * falta según cómo se abra el archivo.
 */
export function bajarCsv(nombre: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export function planillaCaja(asientos: AsientoPlanilla[]): string {
  return hojaCsv(
    ['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Beneficiario', 'Monto', 'Medio de pago'],
    asientos.map(a => [
      a.fecha, a.tipo, a.concepto, a.categoria, a.beneficiario, a.monto, a.medio_pago,
    ]),
  )
}
