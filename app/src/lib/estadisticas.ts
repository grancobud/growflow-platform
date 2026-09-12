// Métricas del cultivo: el cálculo, sin nada de UI.
//
// Las que usa la industria y que acá se pueden derivar de datos que ya se
// cargan, sin pedirle nada nuevo al usuario:
//
//  - g/planta      lo que rinde cada planta, la unidad con la que se compara
//                  una corrida contra otra.
//  - g/W           gramos por vatio de luz. Es LA métrica de eficiencia del
//                  cultivo indoor: 1.0 g/W es un cultivo bien llevado, 0.5 es
//                  flojo. Sale de la potencia cargada en el inventario.
//  - merma         cuánta agua perdió el cogollo al secarse. Lo normal es
//                  75-80%; muy por debajo puede ser que se pesó mal o que
//                  quedó húmedo (riesgo de hongo), muy por arriba es sobresecado.
//  - $/g           lo que cuesta producir un gramo (viene de Econometría).
//
// Todo lo que no se puede calcular devuelve null y NO cero: un cero acá se
// leería como "rinde cero" en vez de "todavía no hay con qué calcularlo".

import { supabase } from './supabase'

export interface CosechaDetallada {
  id: string
  planta_id: string | null
  fecha: string
  peso_seco_g: number | null
  peso_humedo_g: number | null
  valoracion: number | null
  genetica: string | null
  tipo: string | null
  /** Días desde que germinó la planta hasta que se cosechó. */
  dias_ciclo: number | null
}

export interface MetricasGenetica {
  genetica: string
  tipo: string | null
  cosechas: number
  seco: number
  humedo: number
  /** Promedio de gramos secos por cosecha. */
  porCosecha: number
  valoracion: number | null
  /** % de peso que se perdió al secar. Null si no se pesó en húmedo. */
  merma: number | null
  diasCiclo: number | null
  ultima: string | null
}

export interface ResumenEstadisticas {
  totalSeco: number
  totalHumedo: number
  cosechas: number
  /** Gramos secos promedio por cosecha. */
  promedioPorCosecha: number | null
  merma: number | null
  valoracion: number | null
  diasCicloPromedio: number | null
  /** La mejor y la peor, para dar el rango real y no sólo el promedio. */
  mejor: CosechaDetallada | null
  peor: CosechaDetallada | null
}

const prom = (ns: number[]): number | null =>
  ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null

/** Días entre dos fechas ISO. Null si falta alguna o si el orden no cierra. */
export function diasEntre(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null
  const d = Date.parse(desde + 'T00:00:00'), h = Date.parse(hasta + 'T00:00:00')
  if (Number.isNaN(d) || Number.isNaN(h) || h < d) return null
  return Math.round((h - d) / 86400000)
}

/**
 * Merma de secado en %. Sólo tiene sentido si el húmedo es mayor que el seco:
 * si están al revés hay un error de carga y devolver un número igual sería
 * mostrar un dato inventado.
 */
export function mermaSecado(humedo: number | null, seco: number | null): number | null {
  if (!humedo || !seco || humedo <= 0 || seco <= 0 || seco > humedo) return null
  return ((humedo - seco) / humedo) * 100
}

export function resumir(cs: CosechaDetallada[]): ResumenEstadisticas {
  const conPeso = cs.filter(c => (c.peso_seco_g ?? 0) > 0)
  const totalSeco = conPeso.reduce((s, c) => s + (c.peso_seco_g ?? 0), 0)
  const totalHumedo = cs.reduce((s, c) => s + (c.peso_humedo_g ?? 0), 0)
  const ordenadas = [...conPeso].sort((a, b) => (b.peso_seco_g ?? 0) - (a.peso_seco_g ?? 0))
  return {
    totalSeco,
    totalHumedo,
    cosechas: conPeso.length,
    promedioPorCosecha: conPeso.length ? totalSeco / conPeso.length : null,
    merma: mermaSecado(totalHumedo, totalSeco),
    valoracion: prom(cs.map(c => c.valoracion).filter((v): v is number => v != null)),
    diasCicloPromedio: prom(cs.map(c => c.dias_ciclo).filter((d): d is number => d != null)),
    mejor: ordenadas[0] ?? null,
    peor: ordenadas.length > 1 ? ordenadas[ordenadas.length - 1] : null,
  }
}

export function porGenetica(cs: CosechaDetallada[]): MetricasGenetica[] {
  const mapa = new Map<string, CosechaDetallada[]>()
  for (const c of cs) {
    const k = c.genetica ?? 'Sin genética'
    mapa.set(k, [...(mapa.get(k) ?? []), c])
  }
  return [...mapa.entries()].map(([genetica, lista]) => {
    const conPeso = lista.filter(c => (c.peso_seco_g ?? 0) > 0)
    const seco = conPeso.reduce((s, c) => s + (c.peso_seco_g ?? 0), 0)
    const humedo = lista.reduce((s, c) => s + (c.peso_humedo_g ?? 0), 0)
    return {
      genetica,
      tipo: lista.find(c => c.tipo)?.tipo ?? null,
      cosechas: conPeso.length,
      seco,
      humedo,
      porCosecha: conPeso.length ? seco / conPeso.length : 0,
      valoracion: prom(lista.map(c => c.valoracion).filter((v): v is number => v != null)),
      merma: mermaSecado(humedo, seco),
      diasCiclo: prom(lista.map(c => c.dias_ciclo).filter((d): d is number => d != null)),
      ultima: lista.map(c => c.fecha).sort().at(-1) ?? null,
    }
  }).sort((a, b) => b.seco - a.seco)
}

export interface PuntoMes { mes: string; seco: number; cosechas: number }

/**
 * Serie mensual continua: los meses sin cosecha van en cero en vez de faltar.
 * Si se saltean, el gráfico comprime el tiempo y una pausa de tres meses parece
 * un mes flojo.
 */
export function porMes(cs: CosechaDetallada[]): PuntoMes[] {
  const conPeso = cs.filter(c => (c.peso_seco_g ?? 0) > 0 && c.fecha)
  if (!conPeso.length) return []
  const mapa = new Map<string, { seco: number; cosechas: number }>()
  for (const c of conPeso) {
    const k = c.fecha.slice(0, 7)
    const a = mapa.get(k) ?? { seco: 0, cosechas: 0 }
    mapa.set(k, { seco: a.seco + (c.peso_seco_g ?? 0), cosechas: a.cosechas + 1 })
  }
  const claves = [...mapa.keys()].sort()
  const salida: PuntoMes[] = []
  const [a0, m0] = claves[0].split('-').map(Number)
  const [a1, m1] = claves[claves.length - 1].split('-').map(Number)
  for (let a = a0, m = m0; a < a1 || (a === a1 && m <= m1);) {
    const k = `${a}-${String(m).padStart(2, '0')}`
    salida.push({ mes: k, ...(mapa.get(k) ?? { seco: 0, cosechas: 0 }) })
    m++; if (m > 12) { m = 1; a++ }
  }
  return salida
}

/**
 * Plantas distintas que efectivamente dieron cosecha. No es lo mismo que
 * "plantas cerradas": una cosecha por variedad cierra varias plantas y comparte
 * un único registro, así que contar las cerradas inflaba el g/planta.
 */
export function plantasCosechadas(cs: CosechaDetallada[]): number {
  return new Set(cs.filter(c => (c.peso_seco_g ?? 0) > 0 && c.planta_id).map(c => c.planta_id)).size
}

/**
 * Gramos por vatio: el estándar para comparar eficiencia entre cultivos.
 * Usa sólo la potencia de iluminación —no la del extractor ni el AC— porque
 * la métrica se define sobre la luz.
 */
export function gramosPorVatio(totalSeco: number, vatiosLuz: number): number | null {
  if (vatiosLuz <= 0 || totalSeco <= 0) return null
  return totalSeco / vatiosLuz
}

/**
 * Comparación contra el período anterior: lo que convierte un número suelto en
 * información accionable. "169 g por cosecha" no dice nada; "169 g, 12% más que
 * las cinco anteriores" sí.
 *
 * Parte las cosechas ordenadas por fecha en dos mitades del mismo tamaño y
 * compara. Con menos de 4 cosechas devuelve null: dos contra dos es ruido.
 */
export interface Comparacion {
  actual: number
  anterior: number
  /** Variación porcentual. Null si el período anterior fue cero. */
  pct: number | null
  n: number
}

export function compararConAnterior(
  cs: CosechaDetallada[], metrica: (c: CosechaDetallada) => number | null,
): Comparacion | null {
  const validas = cs
    .filter(c => metrica(c) != null && c.fecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (validas.length < 4) return null
  const mitad = Math.floor(validas.length / 2)
  const viejas = validas.slice(0, mitad)
  const nuevas = validas.slice(validas.length - mitad)
  const promedio = (xs: CosechaDetallada[]) =>
    xs.reduce((s, c) => s + (metrica(c) ?? 0), 0) / xs.length
  const actual = promedio(nuevas), anterior = promedio(viejas)
  return {
    actual, anterior,
    pct: anterior > 0 ? ((actual - anterior) / anterior) * 100 : null,
    n: mitad,
  }
}

/**
 * Serie corta para la sparkline de un stat tile. Devuelve los últimos `n`
 * valores en orden cronológico, que es como se lee un gráfico de tendencia.
 */
export function serieReciente(
  cs: CosechaDetallada[], metrica: (c: CosechaDetallada) => number | null, n = 12,
): number[] {
  return cs
    .filter(c => metrica(c) != null && c.fecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-n)
    .map(c => metrica(c) as number)
}

export const estadisticasService = {
  /** Cosechas con la genética y los días de ciclo ya resueltos. */
  async getCosechasDetalladas(): Promise<CosechaDetallada[]> {
    const { data, error } = await supabase
      .from('cosechas')
      .select('id, planta_id, fecha, peso_seco_g, peso_humedo_g, valoracion, plantas:planta_id (fecha_germinacion, geneticas:genetica_id (nombre, tipo))')
      .order('fecha', { ascending: false })
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as RawCosecha[]).map(c => ({
      id: c.id,
      planta_id: c.planta_id,
      fecha: c.fecha,
      peso_seco_g: c.peso_seco_g,
      peso_humedo_g: c.peso_humedo_g,
      valoracion: c.valoracion,
      genetica: c.plantas?.geneticas?.nombre ?? null,
      tipo: c.plantas?.geneticas?.tipo ?? null,
      dias_ciclo: diasEntre(c.plantas?.fecha_germinacion ?? null, c.fecha),
    }))
  },
}

interface RawCosecha {
  id: string
  planta_id: string | null
  fecha: string
  peso_seco_g: number | null
  peso_humedo_g: number | null
  valoracion: number | null
  plantas: {
    fecha_germinacion: string | null
    geneticas: { nombre: string | null; tipo: string | null } | null
  } | null
}
