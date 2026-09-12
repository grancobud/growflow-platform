// areas — las carpas, camas y sectores donde viven las plantas.
//
// Antes esto era una constante en PaginaSala.tsx con la disposicion fisica de
// la instalacion de origen. Al forkear, la asociación veia cinco carpas que nunca
// habia creado. Ahora las carga cada instalacion desde la pantalla.
//
// El `slot` de una planta sigue siendo `<area.id>-<indice>`: el prefijo dice en
// que area esta. No se toco el formato para no romper las plantas ya ubicadas.

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export const TIPOS_AREA = ['carpa', 'cama', 'sector', 'sala', 'mesa', 'invernadero'] as const
export type TipoArea = typeof TIPOS_AREA[number]

export const TIPO_AREA_LABEL: Record<TipoArea, string> = {
  carpa: 'Carpa',
  cama: 'Cama',
  sector: 'Sector',
  sala: 'Sala',
  mesa: 'Mesa',
  invernadero: 'Invernadero',
}

export interface Area {
  id: string
  nombre: string
  tipo: TipoArea
  ancho_m: number | null
  largo_m: number | null
  cols: number
  rows: number
  orden: number
  activa: boolean
  /** Potencia de iluminacion instalada, en watts. Null = sin cargar, no cero. */
  watts: number | null
  /** Horas de luz por dia. Con `watts` alcanza para estimar el consumo. */
  horas_luz: number | null
}

/**
 * Consumo diario del area en kWh. Devuelve null si falta cualquiera de los dos
 * datos: la mitad de una multiplicacion no es una estimacion conservadora, es
 * un numero inventado.
 */
export const kwhDia = (a: Pick<Area, 'watts' | 'horas_luz'>): number | null =>
  a.watts != null && a.watts > 0 && a.horas_luz != null && a.horas_luz > 0
    ? +((a.watts * a.horas_luz) / 1000).toFixed(2)
    : null

/**
 * Consumo de TODAS las areas juntas, en kWh.
 *
 * Existe para que el costo de luz de Econometria se pueda cargar con un numero
 * y no a ojo. NO crea el costo solo: el modelo de costos es de carga manual y
 * un renglon que aparece sin que nadie lo ponga es peor que uno que falta.
 * Mismo criterio que la tarifa por nivel — sugiere, no impone.
 *
 * `sinDatos` es cuantas areas no se pueden estimar por faltarles watts u horas.
 * Sin eso, un total chico se leeria como "consumimos poco" cuando en realidad
 * es "no cargamos la mitad".
 */
export function consumoDeAreas(areas: Pick<Area, 'watts' | 'horas_luz' | 'activa'>[]) {
  const activas = areas.filter(a => a.activa !== false)
  const conDatos = activas.filter(a => kwhDia(a) != null)
  const dia = conDatos.reduce((s, a) => s + (kwhDia(a) ?? 0), 0)
  return {
    dia: +dia.toFixed(2),
    mes: +(dia * 30).toFixed(1),
    areas: activas.length,
    conDatos: conDatos.length,
    sinDatos: activas.length - conDatos.length,
  }
}

/** Consumo mensual, tomando 30 dias. */
export const kwhMes = (a: Pick<Area, 'watts' | 'horas_luz'>): number | null => {
  const d = kwhDia(a)
  return d == null ? null : +(d * 30).toFixed(1)
}

/** Cuantas plantas entran. Se calcula, no se guarda: un derivado guardado se
 *  desincroniza del dibujo apenas alguien cambia las filas. */
export const capacidad = (a: Pick<Area, 'cols' | 'rows'>) => a.cols * a.rows

/** El cartel del area: "1.2 x 1.2 m". Vacio si no cargaron las medidas. */
export function medidaTexto(a: Pick<Area, 'ancho_m' | 'largo_m'>): string {
  if (a.ancho_m == null || a.largo_m == null) return ''
  const n = (v: number) => String(+v.toFixed(2)).replace('.', ',')
  return `${n(a.ancho_m)} × ${n(a.largo_m)} m`
}

// ---------------------------------------------------------------------------
// Sugerencia de grilla
// ---------------------------------------------------------------------------

export const LIMITE_LADO = 40
export const LIMITE_PLANTAS = LIMITE_LADO * LIMITE_LADO

/**
 * Propone filas y columnas para una cantidad de plantas.
 *
 * Busca la grilla que menos lugares desperdicie y que quede lo mas cuadrada
 * posible; el desperdicio pesa el doble que la diferencia entre lados, asi 12
 * da 4x3 y no 6x2. Se prefiere mas ancha que alta porque asi se dibuja en
 * pantalla. Es solo una sugerencia: la pantalla deja corregir los dos numeros,
 * porque un espacio real no siempre entra en la grilla mas prolija.
 */
export function sugerirGrilla(cantidad: number): { cols: number; rows: number } {
  const n = Math.max(1, Math.min(Math.floor(cantidad) || 1, LIMITE_PLANTAS))
  let mejor = { cols: n, rows: 1 }
  let mejorPuntaje = Infinity
  for (let cols = 1; cols <= LIMITE_LADO; cols++) {
    const rows = Math.ceil(n / cols)
    if (rows > LIMITE_LADO) continue
    if (rows > cols) continue // preferimos apaisado; el caso espejo ya se evaluo
    const puntaje = (cols * rows - n) * 2 + (cols - rows)
    if (puntaje < mejorPuntaje) { mejorPuntaje = puntaje; mejor = { cols, rows } }
  }
  return mejor
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

export type AreaNueva = Omit<Area, 'id' | 'activa'> & { activa?: boolean }

export const areasService = {
  async getAreas(): Promise<Area[]> {
    const { data, error } = await supabase
      .from('cultivo_areas').select('*').eq('activa', true).order('orden').order('nombre')
    if (error) throw error
    return (data ?? []) as Area[]
  },

  async crear(a: AreaNueva): Promise<Area> {
    // `activa` se manda explicito y no se deja al default de la columna: el
    // default lo pone Postgres, y en modo demo (localStorage) no hay Postgres.
    // Sin esto el area se guarda pero getAreas() la filtra y no aparece nunca.
    const { data, error } = await supabase
      .from('cultivo_areas').insert({ ...a, activa: a.activa ?? true }).select().single()
    if (error) throw error
    return data as Area
  },

  async actualizar(id: string, a: Partial<Area>): Promise<void> {
    const { error } = await supabase.from('cultivo_areas').update(a).eq('id', id)
    if (error) throw error
  },

  /**
   * Borra un area. Antes suelta las plantas que tenia ubicadas: si se fueran
   * con el area, quedarian con un slot que apunta a algo que ya no existe y
   * desaparecerian del tablero sin avisar. Sueltas vuelven a "Sin ubicar".
   */
  async eliminar(id: string): Promise<number> {
    const { data: sueltas, error: e1 } = await supabase
      .from('plantas').update({ slot: null, ubicacion: null })
      .like('slot', `${id}-%`).select('id')
    if (e1) throw e1
    const { error: e2 } = await supabase.from('cultivo_areas').delete().eq('id', id)
    if (e2) throw e2
    return (sueltas ?? []).length
  },
}
