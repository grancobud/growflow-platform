// Qué hay en el estante, para el lado del cultivo.
//
// POR QUE NO LEE `ong_lotes` DIRECTO
//
// Esa tabla mezcla el stock con la plata: al 30/08/2026 tenía `costo_por_gramo`
// en 97 de 105 lotes, a $X.XXX el gramo — $XX.XXX.XXX de material valorizado.
// El cultivador tiene que ver cuánto queda, no cuánto vale.
//
// Y el RLS no sabe de columnas: una policy deja pasar la fila entera o ninguna.
// Por eso hay una VISTA, `lotes_stock`, que elige qué columnas existen. Ver la
// migración `vista_lotes_stock_sin_plata`.
//
// Lo entregado viene SUMADO por lote —«de este salieron 400 g»— y no entrega por
// entrega: el dato que el cultivo necesita es cuánto queda, sin una sola fila
// que diga a quién se le dio.

import { supabase } from './supabase'

export interface LoteEnStock {
  id: string
  codigo: string
  producto: string | null
  gramos_totales: number
  unidad: string | null
  origen: string | null
  proveedor: string | null
  activo: boolean | null
  fecha_elaboracion: string | null
  thc_pct: number | null
  cbd_pct: number | null
  analisis_path: string | null
  entregado: number
  /** Puede ser NEGATIVO: se entregó más de lo que el lote declara. */
  restante: number
}

/** Lo que entró, lo que salió y lo que queda, en gramos. */
export interface TotalesDeStock {
  lotes: number
  entrado: number
  entregado: number
  restante: number
  /** Lotes con `restante` negativo: se entregó de más. */
  sobregirados: number
}

/**
 * Los totales, contando SÓLO lo que se mide en gramos.
 *
 * El aceite se cuenta en frascos y los accesorios en unidades: sumarlos daría un
 * número que mezcla 21 frascos con X.XXX g y no significa nada. Es el mismo
 * criterio que `balanceMateria`.
 */
export function totalesDeStock(lotes: LoteEnStock[]): TotalesDeStock {
  const enGramos = lotes.filter(l => (l.unidad ?? 'g') === 'g')
  return {
    lotes: lotes.length,
    entrado: enGramos.reduce((s, l) => s + (Number(l.gramos_totales) || 0), 0),
    entregado: enGramos.reduce((s, l) => s + (Number(l.entregado) || 0), 0),
    restante: enGramos.reduce((s, l) => s + (Number(l.restante) || 0), 0),
    sobregirados: lotes.filter(l => (Number(l.restante) || 0) < 0).length,
  }
}

/** Los que todavía tienen material, primero. Un lote vacío ya no es stock. */
export function ordenarPorLoQueQueda(lotes: LoteEnStock[]): LoteEnStock[] {
  return [...lotes].sort((a, b) => {
    const va = (Number(a.restante) || 0) > 0
    const vb = (Number(b.restante) || 0) > 0
    if (va !== vb) return va ? -1 : 1
    return (Number(b.restante) || 0) - (Number(a.restante) || 0)
  })
}

export const stockService = {
  async listar(): Promise<LoteEnStock[]> {
    const { data, error } = await supabase
      .from('lotes_stock')
      .select('*')
      .order('fecha_elaboracion', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as LoteEnStock[]
  },
}
