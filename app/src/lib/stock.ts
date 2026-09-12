// Capa de datos de Stock & Insumos: inventario del cultivo + mantenimiento.

import { supabase } from './supabase'

export type CategoriaInsumo =
  | 'Fertilizante' | 'Iluminacion' | 'Climatizacion' | 'Riego' | 'CO2'
  | 'Sustrato' | 'Sanidad' | 'Medicion' | 'Herramienta' | 'Otro'

export const CATEGORIAS_INSUMO: CategoriaInsumo[] = [
  'Fertilizante', 'Iluminacion', 'Climatizacion', 'Riego', 'CO2',
  'Sustrato', 'Sanidad', 'Medicion', 'Herramienta', 'Otro',
]

export type TipoMantenimiento =
  | 'Limpieza' | 'Recarga' | 'Cambio de filtro' | 'Calibracion' | 'Revision'
  | 'Reemplazo' | 'Lubricacion' | 'Desinfeccion' | 'Otro'

export const TIPOS_MANTENIMIENTO: TipoMantenimiento[] = [
  'Limpieza', 'Recarga', 'Cambio de filtro', 'Calibracion', 'Revision',
  'Reemplazo', 'Lubricacion', 'Desinfeccion', 'Otro',
]

export const UNIDADES = ['u', 'L', 'ml', 'kg', 'g', 'm', 'cm', 'rollo', 'par', 'caja'] as const

export interface Insumo {
  id: string
  nombre: string
  categoria: CategoriaInsumo
  marca: string | null
  modelo: string | null
  cantidad: number
  unidad: string | null
  potencia_w: number | null
  specs: string | null
  dosis: string | null
  uso: string | null
  stock_minimo: number | null
  proveedor: string | null
  precio: number | null
  // Cómo pesa en el costo: capex se amortiza, consumible se gasta por ciclo,
  // recurrente es un gasto mensual. null = se deduce de la categoría.
  clase_costo: 'capex' | 'consumible' | 'recurrente' | null
  notas: string | null
  creado_en: string
  actualizado_en: string
}

export interface Mantenimiento {
  id: string
  insumo_id: string | null
  equipo: string | null
  tipo: TipoMantenimiento
  fecha_realizado: string
  frecuencia_dias: number | null
  proximo: string | null
  responsable: string | null
  notas: string | null
  creado_en: string
}

// Suma n dias a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD.
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Proximo mantenimiento efectivo (el guardado, o calculado por frecuencia).
export function proximoEfectivo(m: Mantenimiento): string | null {
  if (m.proximo) return m.proximo
  if (m.frecuencia_dias && m.fecha_realizado) return sumarDias(m.fecha_realizado, m.frecuencia_dias)
  return null
}

// Dias hasta el proximo (negativo = vencido). null si no esta programado.
export function diasParaProximo(m: Mantenimiento): number | null {
  const p = proximoEfectivo(m)
  if (!p) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const objetivo = new Date(p + 'T00:00:00')
  return Math.round((objetivo.getTime() - hoy.getTime()) / 86400000)
}

export const stockService = {
  async getInsumos(): Promise<Insumo[]> {
    const { data, error } = await supabase.from('insumos').select('*').order('nombre')
    if (error) throw error
    return (data ?? []) as Insumo[]
  },
  async crearInsumo(i: Partial<Insumo>): Promise<Insumo> {
    const { data, error } = await supabase.from('insumos').insert(i).select().single()
    if (error) throw error
    return data as Insumo
  },
  async actualizarInsumo(id: string, i: Partial<Insumo>): Promise<void> {
    const { error } = await supabase.from('insumos')
      .update({ ...i, actualizado_en: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  },
  async eliminarInsumo(id: string): Promise<void> {
    const { error } = await supabase.from('insumos').delete().eq('id', id)
    if (error) throw error
  },

  async getMantenimientos(): Promise<Mantenimiento[]> {
    const { data, error } = await supabase.from('mantenimientos').select('*').order('fecha_realizado', { ascending: false })
    if (error) throw error
    return (data ?? []) as Mantenimiento[]
  },
  async crearMantenimiento(m: Partial<Mantenimiento>): Promise<Mantenimiento> {
    const payload = { ...m }
    if (!payload.proximo && payload.frecuencia_dias && payload.fecha_realizado) {
      payload.proximo = sumarDias(payload.fecha_realizado, payload.frecuencia_dias)
    }
    const { data, error } = await supabase.from('mantenimientos').insert(payload).select().single()
    if (error) throw error
    return data as Mantenimiento
  },
  async actualizarMantenimiento(id: string, m: Partial<Mantenimiento>): Promise<void> {
    const { error } = await supabase.from('mantenimientos').update(m).eq('id', id)
    if (error) throw error
  },
  async eliminarMantenimiento(id: string): Promise<void> {
    const { error } = await supabase.from('mantenimientos').delete().eq('id', id)
    if (error) throw error
  },
}
